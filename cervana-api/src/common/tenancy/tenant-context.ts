import { TenantRole } from '@prisma/client';

export interface TenantContext {
  userId: string;
  tenantId: string | null;
  tenantRole: TenantRole | null;
  isPlatformAdmin: boolean;
}

export const TENANT_HEADER = 'x-tenant-id';

export const tenantWhere = (context: TenantContext): { tenantId?: string } =>
  context.tenantId ? { tenantId: context.tenantId } : {};
