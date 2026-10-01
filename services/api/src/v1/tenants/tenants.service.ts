import { Injectable } from '@nestjs/common';
import { MembershipStatus, Prisma, TenantStatus } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { Actor, PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { TenantContext } from '@/common/tenancy/tenant-context';
import { TenantListQueryType, UpdateTenantType } from './tenants.dto';

const TENANT_TRANSITIONS: Readonly<Record<TenantStatus, readonly TenantStatus[]>> = {
  [TenantStatus.ACTIVE]: [TenantStatus.SUSPENDED, TenantStatus.ARCHIVED],
  [TenantStatus.SUSPENDED]: [TenantStatus.ACTIVE, TenantStatus.ARCHIVED],
  [TenantStatus.ARCHIVED]: [],
};

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  async listMine(actor: Actor) {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { userId: actor.id, status: MembershipStatus.ACTIVE },
      select: {
        role: true,
        tenant: { select: { id: true, name: true, slug: true, status: true, logo: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      message: 'Successfully retrieved tenants',
      data: memberships.map((m) => ({ ...m.tenant, membershipRole: m.role })),
    };
  }

  async getCurrent(context: TenantContext) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: context.tenantId! },
      include: { settings: true },
    });
    if (!tenant) {
      throw new AppError('Tenant not found', 404, AppErrorCode.NOT_FOUND);
    }
    return {
      message: 'Successfully retrieved tenant',
      data: { ...tenant, membershipRole: context.tenantRole },
    };
  }

  async updateCurrent(actor: Actor, context: TenantContext, values: UpdateTenantType, traceId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.tenant.findUnique({
        where: { id: context.tenantId! },
        select: { name: true, description: true, logo: true },
      });
      if (!before) {
        throw new AppError('Tenant not found', 404, AppErrorCode.NOT_FOUND);
      }
      const updated = await tx.tenant.update({
        where: { id: context.tenantId! },
        data: values,
        select: { id: true, name: true, description: true, logo: true },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          tenantId: context.tenantId,
          action: 'TENANT_UPDATED',
          entityType: 'Tenant',
          entityId: context.tenantId!,
          before: before as Prisma.InputJsonValue,
          after: { name: updated.name, description: updated.description, logo: updated.logo } as Prisma.InputJsonValue,
          traceId,
        },
        tx,
      );
      return { message: 'Successfully updated tenant', data: updated };
    });
  }

  async listAll(actor: Actor, query: TenantListQueryType) {
    this.policy.assertAdmin(actor);
    const where: Prisma.TenantWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.q && {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { slug: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return {
      message: 'Successfully retrieved tenants',
      data: {
        data,
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      },
    };
  }

  suspend(actor: Actor, tenantId: string, reason: string, traceId?: string) {
    return this.changeStatus(actor, tenantId, TenantStatus.SUSPENDED, 'TENANT_SUSPENDED', reason, traceId);
  }

  activate(actor: Actor, tenantId: string, reason: string, traceId?: string) {
    return this.changeStatus(actor, tenantId, TenantStatus.ACTIVE, 'TENANT_ACTIVATED', reason, traceId);
  }

  private async changeStatus(
    actor: Actor,
    tenantId: string,
    target: TenantStatus,
    action: string,
    reason: string,
    traceId?: string,
  ) {
    this.policy.assertAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenantId} FOR UPDATE`;
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true, status: true } });
      if (!tenant) {
        throw new AppError('Tenant not found', 404, AppErrorCode.NOT_FOUND);
      }
      if (tenant.status === target) {
        return { message: 'Tenant already in requested state', data: tenant };
      }
      if (!TENANT_TRANSITIONS[tenant.status].includes(target)) {
        throw new AppError(
          `Tenant cannot move from ${tenant.status} to ${target}`,
          409,
          AppErrorCode.INVALID_STATE_TRANSITION,
        );
      }
      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: { status: target },
        select: { id: true, status: true },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          tenantId,
          action,
          entityType: 'Tenant',
          entityId: tenantId,
          before: { status: tenant.status },
          after: { status: updated.status },
          reason,
          traceId,
        },
        tx,
      );
      return { message: 'Tenant status updated', data: updated };
    });
  }
}
