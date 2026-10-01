import { Injectable } from '@nestjs/common';
import { ClassProduct, ClassSessionStatus, ContentStatus, EnrollmentStatus, Prisma, ProductAccessType, TenantRole } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { slugify } from '@/common/lib/utils';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { TenantContext } from '@/common/tenancy/tenant-context';
import { money } from '../commerce/money';
import { assertContentTransition, assertEditable } from '../marketplace/content-state';
import { assertOwnedUploadedFile } from '../uploads/uploaded-file';
import { UploadsService } from '../uploads/uploads.service';
import { assertClassReady } from './class-readiness';
import {
  CreateClassDtoType,
  CreateSessionDtoType,
  EnrollmentListQueryDtoType,
  TeacherClassQueryDtoType,
  UpdateClassDtoType,
  UpdateSessionDtoType,
} from './classes.dto';

const MANAGING_ROLES: readonly TenantRole[] = [TenantRole.OWNER, TenantRole.MANAGER, TenantRole.EDITOR];
const SESSION_EDITABLE: readonly ContentStatus[] = [ContentStatus.DRAFT, ContentStatus.REJECTED, ContentStatus.PUBLISHED];

const summarySelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  coverImage: true,
  accessType: true,
  price: true,
  currency: true,
  format: true,
  difficulty: true,
  durationMinutes: true,
  capacity: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  reviewNote: true,
  publishedAt: true,
  instructorId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClassProductSelect;

@Injectable()
export class ClassAuthoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly uploads: UploadsService,
  ) {}

  async create(actor: Actor, ctx: TenantContext, dto: CreateClassDtoType, traceId?: string) {
    const tenantId = this.requireMember(ctx);
    const price = this.resolvePrice(dto.accessType, dto.price);
    if (dto.coverImage) assertOwnedUploadedFile(this.uploads, actor, dto.coverImage, 'Cover image');

    const created = await this.prisma.$transaction(async (tx) => {
      const slug = dto.slug ?? (await this.uniqueSlug(tx, tenantId, slugify(dto.title)));
      const cls = await this.translateConflict(() =>
        tx.classProduct.create({
          data: {
            tenantId,
            instructorId: actor.id,
            title: dto.title,
            slug,
            description: dto.description ?? null,
            coverImage: dto.coverImage ?? Prisma.JsonNull,
            accessType: dto.accessType,
            price,
            format: dto.format,
            difficulty: dto.difficulty,
            durationMinutes: dto.durationMinutes ?? null,
            capacity: dto.capacity ?? null,
            status: ContentStatus.DRAFT,
          },
          select: summarySelect,
        }),
      );
      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          tenantId,
          action: 'CLASS_CREATED',
          entityType: 'ClassProduct',
          entityId: cls.id,
          after: { status: cls.status, accessType: cls.accessType, format: cls.format },
          traceId,
        },
        tx,
      );
      return cls;
    });
    return { message: 'Class draft created', data: created };
  }

  async list(actor: Actor, ctx: TenantContext, query: TeacherClassQueryDtoType) {
    const tenantId = this.requireMember(ctx);
    const where: Prisma.ClassProductWhereInput = {
      tenantId,
      ...(query.status && { status: query.status }),
      ...(this.ownOnly(ctx) && { instructorId: actor.id }),
    };
    const [data, total] = await Promise.all([
      this.prisma.classProduct.findMany({
        where,
        select: summarySelect,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.classProduct.count({ where }),
    ]);
    return {
      message: 'Successfully retrieved classes',
      data: { data, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } },
    };
  }

  async findOne(actor: Actor, ctx: TenantContext, id: string) {
    const tenantId = this.requireMember(ctx);
    const cls = await this.prisma.classProduct.findFirst({
      where: { id, tenantId },
      select: {
        ...summarySelect,
        sessions: { orderBy: { startsAt: 'asc' } },
        _count: { select: { enrollments: { where: { status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] } } } } },
      },
    });
    if (!cls || (this.ownOnly(ctx) && cls.instructorId !== actor.id)) {
      throw new AppError('Class not found', 404, AppErrorCode.NOT_FOUND);
    }
    return { message: 'Successfully retrieved class', data: cls };
  }

  async update(actor: Actor, ctx: TenantContext, id: string, dto: UpdateClassDtoType, traceId?: string) {
    const tenantId = this.requireMember(ctx);
    if (dto.coverImage) assertOwnedUploadedFile(this.uploads, actor, dto.coverImage, 'Cover image');

    const updated = await this.prisma.$transaction(async (tx) => {
      const cls = await this.lockOwned(tx, ctx, actor, id, tenantId);
      assertEditable(cls.status);

      const accessType = (dto.accessType ?? cls.accessType) as ProductAccessType;
      const priceInput = dto.price !== undefined ? dto.price : (cls.price?.toString() ?? undefined);
      const price = this.resolvePrice(accessType, accessType === ProductAccessType.FREE && dto.price === undefined ? undefined : priceInput);

      const result = await this.translateConflict(() =>
        tx.classProduct.update({
          where: { id },
          data: {
            accessType,
            price,
            ...(dto.title !== undefined && { title: dto.title }),
            ...(dto.slug !== undefined && dto.slug !== cls.slug && { slug: dto.slug }),
            ...(dto.description !== undefined && { description: dto.description }),
            ...(dto.coverImage !== undefined && { coverImage: dto.coverImage }),
            ...(dto.format !== undefined && { format: dto.format }),
            ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
            ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
            ...(dto.capacity !== undefined && { capacity: dto.capacity }),
          },
          select: summarySelect,
        }),
      );
      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          tenantId,
          action: 'CLASS_UPDATED',
          entityType: 'ClassProduct',
          entityId: id,
          after: { fields: Object.keys(dto) },
          traceId,
        },
        tx,
      );
      return result;
    });
    return { message: 'Class updated', data: updated };
  }

  async addSession(actor: Actor, ctx: TenantContext, id: string, dto: CreateSessionDtoType, traceId?: string) {
    const tenantId = this.requireMember(ctx);
    const session = await this.prisma.$transaction(async (tx) => {
      const cls = await this.lockOwned(tx, ctx, actor, id, tenantId);
      this.assertSessionsEditable(cls);
      const created = await tx.classSession.create({
        data: {
          classProductId: id,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          meetingUrl: dto.meetingUrl ?? null,
          recordingUrl: dto.recordingUrl ?? null,
        },
      });
      await this.audit.record(
        { actorId: actor.id, actorRole: actor.role, tenantId, action: 'CLASS_SESSION_ADDED', entityType: 'ClassSession', entityId: created.id, after: { classId: id }, traceId },
        tx,
      );
      return created;
    });
    return { message: 'Session added', data: session };
  }

  async updateSession(actor: Actor, ctx: TenantContext, id: string, sessionId: string, dto: UpdateSessionDtoType, traceId?: string) {
    const tenantId = this.requireMember(ctx);
    const session = await this.prisma.$transaction(async (tx) => {
      const cls = await this.lockOwned(tx, ctx, actor, id, tenantId);
      this.assertSessionsEditable(cls);
      const current = await tx.classSession.findFirst({ where: { id: sessionId, classProductId: id } });
      if (!current) {
        throw new AppError('Session not found', 404, AppErrorCode.NOT_FOUND);
      }
      if (current.status === ClassSessionStatus.CANCELLED) {
        throw new AppError('A cancelled session cannot be changed', 409, AppErrorCode.CONTENT_LOCKED);
      }
      const startsAt = dto.startsAt ?? current.startsAt;
      const endsAt = dto.endsAt ?? current.endsAt;
      if (endsAt <= startsAt) {
        throw new AppError('endsAt must be after startsAt', 422, AppErrorCode.VALIDATION_ERROR);
      }
      const updated = await tx.classSession.update({
        where: { id: sessionId },
        data: {
          startsAt,
          endsAt,
          ...(dto.meetingUrl !== undefined && { meetingUrl: dto.meetingUrl }),
          ...(dto.recordingUrl !== undefined && { recordingUrl: dto.recordingUrl }),
        },
      });
      await this.audit.record(
        { actorId: actor.id, actorRole: actor.role, tenantId, action: 'CLASS_SESSION_UPDATED', entityType: 'ClassSession', entityId: sessionId, after: { fields: Object.keys(dto) }, traceId },
        tx,
      );
      return updated;
    });
    return { message: 'Session updated', data: session };
  }

  async cancelSession(actor: Actor, ctx: TenantContext, id: string, sessionId: string, traceId?: string) {
    const tenantId = this.requireMember(ctx);
    const result = await this.prisma.$transaction(async (tx) => {
      const cls = await this.lockOwned(tx, ctx, actor, id, tenantId);
      this.assertSessionsEditable(cls);
      const current = await tx.classSession.findFirst({ where: { id: sessionId, classProductId: id } });
      if (!current) {
        throw new AppError('Session not found', 404, AppErrorCode.NOT_FOUND);
      }
      if (current.status === ClassSessionStatus.CANCELLED) {
        return { changed: false, session: current };
      }
      const updated = await tx.classSession.update({ where: { id: sessionId }, data: { status: ClassSessionStatus.CANCELLED } });
      await this.audit.record(
        { actorId: actor.id, actorRole: actor.role, tenantId, action: 'CLASS_SESSION_CANCELLED', entityType: 'ClassSession', entityId: sessionId, before: { status: current.status }, after: { status: updated.status }, traceId },
        tx,
      );
      return { changed: true, session: updated };
    });
    return { message: result.changed ? 'Session cancelled' : 'Session already cancelled', data: result.session };
  }

  async enrollments(actor: Actor, ctx: TenantContext, id: string, query: EnrollmentListQueryDtoType) {
    const tenantId = this.requireMember(ctx);
    const cls = await this.prisma.classProduct.findFirst({ where: { id, tenantId }, select: { id: true, instructorId: true, capacity: true } });
    if (!cls || (this.ownOnly(ctx) && cls.instructorId !== actor.id)) {
      throw new AppError('Class not found', 404, AppErrorCode.NOT_FOUND);
    }
    const where: Prisma.ClassEnrollmentWhereInput = { classProductId: id };
    const [rows, total, byStatus, sessions] = await Promise.all([
      this.prisma.classEnrollment.findMany({
        where,
        orderBy: { enrolledAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: { id: true, status: true, enrolledAt: true, completedAt: true, user: { select: { id: true, name: true } } },
      }),
      this.prisma.classEnrollment.count({ where }),
      this.prisma.classEnrollment.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.classSession.findMany({
        where: { classProductId: id },
        orderBy: { startsAt: 'asc' },
        select: { id: true, startsAt: true, status: true, _count: { select: { attendances: true } } },
      }),
    ]);
    return {
      message: 'Successfully retrieved enrollments',
      data: {
        capacity: cls.capacity,
        counts: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
        sessions: sessions.map((session) => ({ id: session.id, startsAt: session.startsAt, status: session.status, attended: session._count.attendances })),
        data: rows,
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      },
    };
  }

  submitReview(actor: Actor, ctx: TenantContext, id: string, traceId?: string) {
    return this.move(actor, ctx, id, ContentStatus.PENDING_REVIEW, 'CLASS_SUBMITTED', traceId, async (tx, cls) => {
      const sessions = await tx.classSession.findMany({ where: { classProductId: cls.id }, select: { status: true, meetingUrl: true, recordingUrl: true } });
      assertClassReady(cls.format, sessions);
      return { submittedAt: new Date() };
    });
  }

  withdraw(actor: Actor, ctx: TenantContext, id: string, traceId?: string) {
    return this.move(actor, ctx, id, ContentStatus.DRAFT, 'CLASS_WITHDRAWN', traceId);
  }

  archive(actor: Actor, ctx: TenantContext, id: string, traceId?: string) {
    return this.move(actor, ctx, id, ContentStatus.ARCHIVED, 'CLASS_ARCHIVED', traceId, async (_tx, cls) => {
      if (cls.status === ContentStatus.SUSPENDED) {
        throw new AppError('A suspended class can only be archived by an administrator', 403, AppErrorCode.FORBIDDEN);
      }
      return {};
    });
  }

  private async move(
    actor: Actor,
    ctx: TenantContext,
    id: string,
    target: ContentStatus,
    action: string,
    traceId: string | undefined,
    prepare?: (tx: Prisma.TransactionClient, cls: ClassProduct) => Promise<Prisma.ClassProductUpdateInput>,
  ) {
    const tenantId = this.requireMember(ctx);
    const result = await this.prisma.$transaction(async (tx) => {
      const cls = await this.lockOwned(tx, ctx, actor, id, tenantId);
      if (cls.status === target) {
        return { cls, changed: false };
      }
      assertContentTransition(cls.status, target);
      const extra = prepare ? await prepare(tx, cls) : {};
      const updated = await tx.classProduct.update({ where: { id }, data: { status: target, ...extra }, select: summarySelect });
      await this.audit.record(
        { actorId: actor.id, actorRole: actor.role, tenantId, action, entityType: 'ClassProduct', entityId: id, before: { status: cls.status }, after: { status: updated.status }, traceId },
        tx,
      );
      return { cls: updated, changed: true };
    });
    return { message: result.changed ? 'Class updated' : 'Class already in the requested state', data: result.cls };
  }

  private assertSessionsEditable(cls: ClassProduct) {
    if (!SESSION_EDITABLE.includes(cls.status)) {
      throw new AppError(`Sessions cannot be changed while the class is ${cls.status}`, 409, AppErrorCode.CONTENT_LOCKED);
    }
  }

  private requireMember(ctx: TenantContext): string {
    if (ctx.isPlatformAdmin || !ctx.tenantId) {
      throw new AppError('A tenant membership is required', 403, AppErrorCode.TENANT_ACCESS_DENIED);
    }
    return ctx.tenantId;
  }

  private ownOnly(ctx: TenantContext): boolean {
    return !(ctx.tenantRole && MANAGING_ROLES.includes(ctx.tenantRole));
  }

  private async lockOwned(tx: Prisma.TransactionClient, ctx: TenantContext, actor: Actor, id: string, tenantId: string): Promise<ClassProduct> {
    await tx.$queryRaw`SELECT id FROM "ClassProduct" WHERE id = ${id} FOR UPDATE`;
    const cls = await tx.classProduct.findFirst({ where: { id, tenantId } });
    if (!cls) {
      throw new AppError('Class not found', 404, AppErrorCode.NOT_FOUND);
    }
    if (cls.instructorId !== actor.id && this.ownOnly(ctx)) {
      throw new AppError('Only the instructor or a tenant manager can change this class', 403, AppErrorCode.OWNERSHIP_DENIED);
    }
    return cls;
  }

  private resolvePrice(accessType: ProductAccessType, input: string | number | undefined): Prisma.Decimal | null {
    if (accessType === ProductAccessType.FREE) {
      if (input !== undefined) {
        throw new AppError('A free class cannot have a price', 422, AppErrorCode.VALIDATION_ERROR);
      }
      return null;
    }
    if (input === undefined) {
      throw new AppError('A paid class needs a price', 422, AppErrorCode.VALIDATION_ERROR);
    }
    const price = money(input);
    if (price.lessThanOrEqualTo(0)) {
      throw new AppError('The price must be greater than zero', 422, AppErrorCode.VALIDATION_ERROR);
    }
    return price;
  }

  private async uniqueSlug(tx: Prisma.TransactionClient, tenantId: string, base: string): Promise<string> {
    const root = base && base.length >= 3 ? base.slice(0, 70) : `class-${Date.now().toString(36)}`;
    const taken = new Set(
      (await tx.classProduct.findMany({ where: { tenantId, slug: { startsWith: root } }, select: { slug: true } })).map((row) => row.slug),
    );
    if (!taken.has(root)) return root;
    for (let n = 2; n < 1000; n += 1) {
      const candidate = `${root}-${n}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${root}-${Date.now().toString(36)}`;
  }

  private async translateConflict<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'P2002') {
        throw new AppError('This slug is already used in your tenant', 409, AppErrorCode.UNIQUE_CONSTRAINT_FAILED);
      }
      if (String((error as { message?: string }).message).includes('capacity cannot be lower')) {
        throw new AppError('Capacity cannot be lower than the current enrollments', 409, AppErrorCode.CLASS_FULL);
      }
      throw error;
    }
  }
}
