import { Injectable } from '@nestjs/common';
import {
  ClassProduct,
  ContentStatus,
  EnrollmentStatus,
  EntitlementResourceType,
  Order,
  OrderItem,
  Prisma,
  ProductAccessType,
  TenantStatus,
} from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { DomainEventBus } from '@/common/events/domain-event-bus';
import { READABLE_BY_BUYERS } from '../marketplace/content-state';
import {
  CLASS_AGGREGATE,
  ClassAttendedPayload,
  ClassEnrollmentEventPayload,
  ContentEvents,
} from '../marketplace/content-events';
import { EnrollmentListQueryDtoType } from './classes.dto';

const ATTEND_LEAD_MS = 15 * 60 * 1000;
const HOLDING: EnrollmentStatus[] = [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED];

type LockedClass = Pick<ClassProduct, 'id' | 'tenantId' | 'accessType' | 'status' | 'capacity'>;

@Injectable()
export class ClassEnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly bus: DomainEventBus,
  ) {}

  async enrollFree(actor: Actor, classId: string, traceId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const cls = await this.lockClass(tx, classId);
      if (cls.status !== ContentStatus.PUBLISHED || !(await this.tenantActive(tx, cls.tenantId))) {
        throw new AppError('Class not found', 404, AppErrorCode.CONTENT_NOT_PUBLISHED);
      }
      if (cls.accessType !== ProductAccessType.FREE) {
        throw new AppError('A paid class is purchased, not joined', 422, AppErrorCode.VALIDATION_ERROR);
      }
      const outcome = await this.activate(tx, cls, actor.id, null, true, traceId);
      if (outcome.created) {
        await this.audit.record(
          {
            actorId: actor.id,
            actorRole: actor.role,
            tenantId: cls.tenantId,
            action: 'CLASS_ENROLLED',
            entityType: 'ClassEnrollment',
            entityId: outcome.enrollment.id,
            after: { classId, free: true },
            traceId,
          },
          tx,
        );
      }
      return outcome;
    });
    return {
      message: result.created ? 'Enrolled' : 'Already enrolled',
      data: { enrollmentId: result.enrollment.id, status: result.enrollment.status, created: result.created },
    };
  }

  async enrollForOrder(tx: Prisma.TransactionClient, order: Pick<Order, 'id' | 'userId'>, items: OrderItem[], traceId?: string | null) {
    for (const item of items) {
      if (!item.classId) continue;
      const cls = await this.lockClass(tx, item.classId);
      await this.activate(tx, cls, order.userId, order.id, false, traceId ?? undefined);
    }
  }

  async cancelFree(actor: Actor, classId: string, traceId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const cls = await this.lockClass(tx, classId);
      const enrollment = await tx.classEnrollment.findUnique({
        where: { classProductId_userId: { classProductId: classId, userId: actor.id } },
      });
      if (!enrollment) {
        throw new AppError('Enrollment not found', 404, AppErrorCode.NOT_FOUND);
      }
      if (enrollment.status === EnrollmentStatus.CANCELLED) {
        return { changed: false, enrollment };
      }
      if (enrollment.status === EnrollmentStatus.COMPLETED) {
        throw new AppError('A completed class cannot be cancelled', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      if (cls.accessType !== ProductAccessType.FREE || enrollment.orderId) {
        throw new AppError('A paid enrollment cannot be cancelled here; ask for a refund', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      const updated = await tx.classEnrollment.update({
        where: { id: enrollment.id },
        data: { status: EnrollmentStatus.CANCELLED },
      });
      await tx.entitlement.updateMany({
        where: { userId: actor.id, classId, status: 'ACTIVE' },
        data: { status: 'REVOKED', expiresAt: new Date() },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          tenantId: cls.tenantId,
          action: 'CLASS_ENROLLMENT_CANCELLED',
          entityType: 'ClassEnrollment',
          entityId: enrollment.id,
          before: { status: enrollment.status },
          after: { status: updated.status },
          traceId,
        },
        tx,
      );
      return { changed: true, enrollment: updated };
    });
    return {
      message: result.changed ? 'Enrollment cancelled' : 'Enrollment already cancelled',
      data: { enrollmentId: result.enrollment.id, status: result.enrollment.status },
    };
  }

  async attend(actor: Actor, classId: string, sessionId: string, now: Date = new Date(), traceId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const enrollment = await this.activeEnrollment(tx, actor.id, classId);
      const cls = await tx.classProduct.findFirst({
        where: { id: classId, status: { in: [...READABLE_BY_BUYERS] }, tenant: { status: TenantStatus.ACTIVE } },
        select: { id: true, tenantId: true },
      });
      const session = await tx.classSession.findFirst({ where: { id: sessionId, classProductId: classId } });
      if (!cls || !session) {
        throw new AppError('Session not found', 404, AppErrorCode.NOT_FOUND);
      }
      if (session.status === 'CANCELLED') {
        throw new AppError('This session was cancelled', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      if (now.getTime() < session.startsAt.getTime() - ATTEND_LEAD_MS) {
        throw new AppError('This session has not started yet', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      const inserted = await tx.classAttendance.createMany({
        data: [{ sessionId, userId: actor.id, attendedAt: now }],
        skipDuplicates: true,
      });
      if (inserted.count === 1) {
        const payload: ClassAttendedPayload = { classId, sessionId, userId: actor.id, tenantId: cls.tenantId };
        await this.bus.publish(
          {
            type: ContentEvents.ClassAttended,
            aggregateType: CLASS_AGGREGATE,
            aggregateId: classId,
            dedupeKey: `${ContentEvents.ClassAttended}:${sessionId}:${actor.id}`,
            payload,
            tenantId: cls.tenantId,
            actorId: actor.id,
            traceId: traceId ?? null,
          },
          tx,
        );
      }
      return { first: inserted.count === 1, enrollmentId: enrollment.id };
    });
    return { message: result.first ? 'Attendance recorded' : 'Attendance already recorded', data: { sessionId, first: result.first } };
  }

  async complete(actor: Actor, classId: string, now: Date = new Date(), traceId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const cls = await this.lockClass(tx, classId);
      const enrollment = await tx.classEnrollment.findUnique({
        where: { classProductId_userId: { classProductId: classId, userId: actor.id } },
      });
      if (!enrollment || enrollment.status === EnrollmentStatus.CANCELLED) {
        throw new AppError('You are not enrolled in this class', 403, AppErrorCode.ENTITLEMENT_REQUIRED);
      }
      if (enrollment.status === EnrollmentStatus.COMPLETED) {
        return { changed: false, enrollment };
      }

      const sessions = await tx.classSession.findMany({
        where: { classProductId: classId, status: { not: 'CANCELLED' } },
        select: { id: true, endsAt: true },
      });
      if (sessions.length === 0) {
        throw new AppError('This class has no sessions to complete', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      if (sessions.some((session) => session.endsAt.getTime() > now.getTime())) {
        throw new AppError('The class is still running', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      const attended = await tx.classAttendance.count({
        where: { userId: actor.id, sessionId: { in: sessions.map((session) => session.id) } },
      });
      if (attended < sessions.length) {
        throw new AppError('Attend every session before completing the class', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }

      const updated = await tx.classEnrollment.update({
        where: { id: enrollment.id },
        data: { status: EnrollmentStatus.COMPLETED, completedAt: now },
      });
      const payload: ClassEnrollmentEventPayload = {
        classId,
        enrollmentId: enrollment.id,
        userId: actor.id,
        tenantId: cls.tenantId,
        orderId: enrollment.orderId,
      };
      await this.bus.publish(
        {
          type: ContentEvents.ClassCompleted,
          aggregateType: CLASS_AGGREGATE,
          aggregateId: classId,
          dedupeKey: `${ContentEvents.ClassCompleted}:${enrollment.id}`,
          payload,
          tenantId: cls.tenantId,
          actorId: actor.id,
          traceId: traceId ?? null,
        },
        tx,
      );
      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          tenantId: cls.tenantId,
          action: 'CLASS_COMPLETED',
          entityType: 'ClassEnrollment',
          entityId: enrollment.id,
          before: { status: enrollment.status },
          after: { status: updated.status },
          traceId,
        },
        tx,
      );
      return { changed: true, enrollment: updated };
    });
    return {
      message: result.changed ? 'Class completed' : 'Class already completed',
      data: { enrollmentId: result.enrollment.id, status: result.enrollment.status, completedAt: result.enrollment.completedAt },
    };
  }

  async listMine(actor: Actor, query: EnrollmentListQueryDtoType) {
    const where: Prisma.ClassEnrollmentWhereInput = { userId: actor.id };
    const [data, total] = await Promise.all([
      this.prisma.classEnrollment.findMany({
        where,
        orderBy: { enrolledAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          status: true,
          enrolledAt: true,
          completedAt: true,
          classProduct: {
            select: { id: true, title: true, slug: true, coverImage: true, format: true, tenant: { select: { id: true, name: true, slug: true } } },
          },
        },
      }),
      this.prisma.classEnrollment.count({ where }),
    ]);
    return {
      message: 'Successfully retrieved enrollments',
      data: { data, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } },
    };
  }

  async activeEnrollment(client: Pick<Prisma.TransactionClient, 'classEnrollment'>, userId: string, classId: string) {
    const enrollment = await client.classEnrollment.findUnique({
      where: { classProductId_userId: { classProductId: classId, userId } },
    });
    if (!enrollment || !HOLDING.includes(enrollment.status)) {
      throw new AppError('You are not enrolled in this class', 403, AppErrorCode.ENTITLEMENT_REQUIRED);
    }
    return enrollment;
  }

  private async activate(
    tx: Prisma.TransactionClient,
    cls: LockedClass,
    userId: string,
    orderId: string | null,
    grantEntitlement: boolean,
    traceId?: string,
  ) {
    const existing = await tx.classEnrollment.findUnique({
      where: { classProductId_userId: { classProductId: cls.id, userId } },
    });
    if (existing && HOLDING.includes(existing.status)) {
      return { enrollment: existing, created: false };
    }

    if (cls.capacity !== null) {
      const taken = await tx.classEnrollment.count({
        where: { classProductId: cls.id, status: { in: HOLDING } },
      });
      if (taken >= cls.capacity) {
        throw new AppError('This class is full', 409, AppErrorCode.CLASS_FULL);
      }
    }

    const enrolledAt = new Date();
    const enrollment = existing
      ? await tx.classEnrollment.update({
          where: { id: existing.id },
          data: { status: EnrollmentStatus.ACTIVE, orderId, enrolledAt, completedAt: null },
        })
      : await tx.classEnrollment.create({
          data: { classProductId: cls.id, userId, orderId, status: EnrollmentStatus.ACTIVE, enrolledAt },
        });

    if (grantEntitlement) {
      await tx.entitlement.upsert({
        where: { userId_classId: { userId, classId: cls.id } },
        create: {
          userId,
          tenantId: cls.tenantId,
          resourceType: EntitlementResourceType.CLASS,
          classId: cls.id,
          orderId,
          status: 'ACTIVE',
          startsAt: enrolledAt,
        },
        update: { status: 'ACTIVE', startsAt: enrolledAt, expiresAt: null, orderId },
      });
    }

    const payload: ClassEnrollmentEventPayload = {
      classId: cls.id,
      enrollmentId: enrollment.id,
      userId,
      tenantId: cls.tenantId,
      orderId,
    };
    await this.bus.publish(
      {
        type: ContentEvents.ClassEnrolled,
        aggregateType: CLASS_AGGREGATE,
        aggregateId: cls.id,
        dedupeKey: `${ContentEvents.ClassEnrolled}:${enrollment.id}:${enrolledAt.getTime()}`,
        payload,
        tenantId: cls.tenantId,
        actorId: userId,
        traceId: traceId ?? null,
      },
      tx,
    );

    return { enrollment, created: true };
  }

  private async lockClass(tx: Prisma.TransactionClient, classId: string): Promise<LockedClass> {
    await tx.$queryRaw`SELECT id FROM "ClassProduct" WHERE id = ${classId} FOR UPDATE`;
    const cls = await tx.classProduct.findUnique({
      where: { id: classId },
      select: { id: true, tenantId: true, accessType: true, status: true, capacity: true },
    });
    if (!cls) {
      throw new AppError('Class not found', 404, AppErrorCode.NOT_FOUND);
    }
    return cls;
  }

  private async tenantActive(tx: Prisma.TransactionClient, tenantId: string): Promise<boolean> {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { status: true } });
    return tenant?.status === TenantStatus.ACTIVE;
  }
}
