import { Injectable } from '@nestjs/common';
import { MembershipStatus, Role, TenantRole, TenantStatus } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { Actor } from '@/common/authz/policy.service';
import { TenantContext } from './tenant-context';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ResolveOptions {
  roles?: readonly TenantRole[];
  requireTenant?: boolean;
}

@Injectable()
export class TenantContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    actor: Actor | undefined | null,
    requestedTenantId: string | undefined,
    options: ResolveOptions = {},
  ): Promise<TenantContext> {
    if (!actor?.id) {
      throw new AppError('Authentication required', 401, AppErrorCode.UNAUTHORIZED);
    }
    if (requestedTenantId !== undefined && !UUID.test(requestedTenantId)) {
      throw new AppError('Tenant identifier is malformed', 400, AppErrorCode.VALIDATION_ERROR);
    }
    const requireTenant = options.requireTenant ?? true;

    if (actor.role === Role.ADMIN) {
      if (!requestedTenantId) {
        if (requireTenant) {
          throw new AppError('Tenant identifier is required', 400, AppErrorCode.TENANT_REQUIRED);
        }
        return { userId: actor.id, tenantId: null, tenantRole: null, isPlatformAdmin: true };
      }
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: requestedTenantId },
        select: { id: true },
      });
      if (!tenant) {
        throw new AppError('Tenant not found', 404, AppErrorCode.NOT_FOUND);
      }
      return { userId: actor.id, tenantId: tenant.id, tenantRole: null, isPlatformAdmin: true };
    }

    if (actor.role !== Role.TEACHER) {
      throw new AppError('Tenant access denied', 403, AppErrorCode.TENANT_ACCESS_DENIED);
    }

    const memberships = await this.prisma.tenantMembership.findMany({
      where: {
        userId: actor.id,
        status: MembershipStatus.ACTIVE,
        tenant: { status: TenantStatus.ACTIVE },
      },
      select: { tenantId: true, role: true },
    });

    let membership = memberships[0];
    if (requestedTenantId) {
      membership = memberships.find((m) => m.tenantId === requestedTenantId) as typeof membership;
      if (!membership) {
        throw new AppError('Tenant access denied', 403, AppErrorCode.TENANT_ACCESS_DENIED);
      }
    } else if (memberships.length === 0) {
      throw new AppError('Tenant access denied', 403, AppErrorCode.TENANT_ACCESS_DENIED);
    } else if (memberships.length > 1) {
      throw new AppError('Tenant identifier is required', 400, AppErrorCode.TENANT_REQUIRED);
    }

    if (options.roles && !options.roles.includes(membership.role)) {
      throw new AppError('Tenant role is insufficient', 403, AppErrorCode.TENANT_ROLE_INSUFFICIENT);
    }

    return {
      userId: actor.id,
      tenantId: membership.tenantId,
      tenantRole: membership.role,
      isPlatformAdmin: false,
    };
  }
}
