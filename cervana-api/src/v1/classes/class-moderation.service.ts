import { Injectable } from '@nestjs/common';
import { ClassProduct, ContentStatus, Prisma, TenantStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor, PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { DomainEventBus } from '@/common/events/domain-event-bus';
import { assertContentTransition } from '../marketplace/content-state';
import { CLASS_AGGREGATE, ClassPublishedPayload, ContentEvents } from '../marketplace/content-events';
import { assertClassReady } from './class-readiness';
import { AdminClassQueryDtoType } from './classes.dto';

const reviewSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  accessType: true,
  price: true,
  currency: true,
  format: true,
  difficulty: true,
  capacity: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  reviewNote: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  tenant: { select: { id: true, name: true, slug: true, status: true } },
  instructor: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ClassProductSelect;

@Injectable()
export class ClassModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly bus: DomainEventBus,
  ) {}

  async queue(actor: Actor, query: AdminClassQueryDtoType) {
    this.policy.assertAdmin(actor);
    const where: Prisma.ClassProductWhereInput = { status: query.status, ...(query.tenantId && { tenantId: query.tenantId }) };
    const [data, total] = await Promise.all([
      this.prisma.classProduct.findMany({
        where,
        select: reviewSelect,
        orderBy: query.status === ContentStatus.PENDING_REVIEW ? { submittedAt: 'asc' } : { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.classProduct.count({ where }),
    ]);
    return {
      message: 'Successfully retrieved the class queue',
      data: { data, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } },
    };
  }

  async findOne(actor: Actor, id: string) {
    this.policy.assertAdmin(actor);
    const cls = await this.prisma.classProduct.findUnique({
      where: { id },
      select: { ...reviewSelect, sessions: { orderBy: { startsAt: 'asc' } } },
    });
    if (!cls) {
      throw new AppError('Class not found', 404, AppErrorCode.NOT_FOUND);
    }
    return { message: 'Successfully retrieved class', data: cls };
  }

  approve(actor: Actor, id: string, note: string | undefined, traceId?: string) {
    return this.review(actor, id, ContentStatus.PUBLISHED, 'CLASS_APPROVED', note, traceId, async (tx, cls, now) => {
      await this.assertPublishable(tx, cls);
      return {
        data: { publishedAt: cls.publishedAt ?? now },
        after: () => this.publishedEvent(tx, cls, actor, traceId),
      };
    });
  }

  reject(actor: Actor, id: string, reason: string, traceId?: string) {
    return this.review(actor, id, ContentStatus.REJECTED, 'CLASS_REJECTED', reason, traceId);
  }

  suspend(actor: Actor, id: string, reason: string, traceId?: string) {
    return this.review(actor, id, ContentStatus.SUSPENDED, 'CLASS_SUSPENDED', reason, traceId);
  }

  reinstate(actor: Actor, id: string, note: string | undefined, traceId?: string) {
    return this.review(actor, id, ContentStatus.PUBLISHED, 'CLASS_REINSTATED', note, traceId, async (tx, cls) => {
      await this.assertPublishable(tx, cls);
      return { data: {} };
    });
  }

  archive(actor: Actor, id: string, reason: string | undefined, traceId?: string) {
    return this.review(actor, id, ContentStatus.ARCHIVED, 'CLASS_ARCHIVED', reason, traceId);
  }

  private async assertPublishable(tx: Prisma.TransactionClient, cls: ClassProduct) {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: cls.tenantId }, select: { status: true } });
    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new AppError('The tenant is not active', 409, AppErrorCode.INVALID_STATE_TRANSITION);
    }
    const sessions = await tx.classSession.findMany({ where: { classProductId: cls.id }, select: { status: true, meetingUrl: true, recordingUrl: true } });
    assertClassReady(cls.format, sessions);
  }

  private async publishedEvent(tx: Prisma.TransactionClient, cls: ClassProduct, actor: Actor, traceId?: string) {
    const payload: ClassPublishedPayload = {
      classId: cls.id,
      tenantId: cls.tenantId,
      instructorId: cls.instructorId,
      accessType: cls.accessType,
      price: cls.price?.toString() ?? null,
      currency: cls.currency,
      format: cls.format,
    };
    await this.bus.publish(
      {
        type: ContentEvents.ClassPublished,
        aggregateType: CLASS_AGGREGATE,
        aggregateId: cls.id,
        dedupeKey: `${ContentEvents.ClassPublished}:${cls.id}`,
        payload,
        tenantId: cls.tenantId,
        actorId: actor.id,
        traceId: traceId ?? null,
      },
      tx,
    );
  }

  private async review(
    actor: Actor,
    id: string,
    target: ContentStatus,
    action: string,
    note: string | undefined,
    traceId: string | undefined,
    prepare?: (
      tx: Prisma.TransactionClient,
      cls: ClassProduct,
      now: Date,
    ) => Promise<{ data: Prisma.ClassProductUncheckedUpdateInput; after?: () => Promise<void> }>,
  ) {
    this.policy.assertAdmin(actor);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ClassProduct" WHERE id = ${id} FOR UPDATE`;
      const cls = await tx.classProduct.findUnique({ where: { id } });
      if (!cls) {
        throw new AppError('Class not found', 404, AppErrorCode.NOT_FOUND);
      }
      if (cls.status === target) {
        return { changed: false, status: cls.status };
      }
      assertContentTransition(cls.status, target);

      const now = new Date();
      const prepared = prepare ? await prepare(tx, cls, now) : { data: {} };
      const updated = await tx.classProduct.update({
        where: { id },
        data: { status: target, reviewedById: actor.id, reviewedAt: now, reviewNote: note ?? null, ...prepared.data },
        select: { status: true },
      });
      if (prepared.after) await prepared.after();

      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          tenantId: cls.tenantId,
          action,
          entityType: 'ClassProduct',
          entityId: id,
          before: { status: cls.status },
          after: { status: updated.status },
          reason: note ?? null,
          traceId,
        },
        tx,
      );
      return { changed: true, status: updated.status };
    });
    return {
      message: result.changed ? 'Class updated' : 'Class already in the requested state',
      data: { id, status: result.status, changed: result.changed },
    };
  }
}
