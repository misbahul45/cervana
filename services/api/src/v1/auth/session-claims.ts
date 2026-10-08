import { Role, TenantRole } from '@prisma/client';

export type SessionCapability = 'ADMIN' | 'REVIEWER' | 'CREATOR';

export interface SessionClaims {
  tenantRoles: TenantRole[];
  capabilities: SessionCapability[];
}

export function deriveSessionClaims(
  role: Role,
  memberships: ReadonlyArray<{ role: TenantRole }>,
): SessionClaims {
  const tenantRoles = [...new Set(memberships.map((membership) => membership.role))];
  const capabilities: SessionCapability[] = [];

  if (role === Role.ADMIN) capabilities.push('ADMIN');
  if (role === Role.REVIEWER) capabilities.push('REVIEWER');
  if (role === Role.TEACHER || tenantRoles.length > 0) capabilities.push('CREATOR');

  return { tenantRoles, capabilities };
}
