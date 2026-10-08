import type { RouteLocationNormalized } from 'vue-router';

export type UserRole = 'STUDENT' | 'TEACHER' | 'REVIEWER' | 'ADMIN';

export type TenantRole = 'OWNER' | 'MANAGER' | 'TEACHER' | 'EDITOR';

export type Capability = 'ADMIN' | 'REVIEWER' | 'CREATOR';

export type PageProtection =
  | { kind: 'public' }
  | { kind: 'guest-only' }
  | { kind: 'authenticated' }
  | { kind: 'role'; role: UserRole }
  | { kind: 'tenant-role'; tenantRoles: TenantRole[] }
  | { kind: 'capability'; capability: Capability };

export interface RouteMeta {
  title?: string;
  protection?: PageProtection;
  showInBreadcrumb?: boolean;
}

declare module 'vue-router' {
  interface RouteMeta extends Record<string, unknown> {
    protection?: PageProtection;
    title?: string;
    showInBreadcrumb?: boolean;
  }
}

export function isPublic(meta: RouteMeta | undefined): boolean {
  return meta?.protection?.kind === 'public' || meta?.protection?.kind === 'guest-only';
}

export function requiresAuthentication(meta: RouteMeta | undefined): boolean {
  if (!meta?.protection) return true;
  return meta.protection.kind !== 'public' && meta.protection.kind !== 'guest-only';
}

export function getRequiredRole(meta: RouteMeta | undefined): UserRole | undefined {
  return meta?.protection?.kind === 'role' ? meta.protection.role : undefined;
}

export function getRequiredTenantRoles(meta: RouteMeta | undefined): TenantRole[] | undefined {
  return meta?.protection?.kind === 'tenant-role' ? meta.protection.tenantRoles : undefined;
}

export function getRequiredCapability(meta: RouteMeta | undefined): Capability | undefined {
  return meta?.protection?.kind === 'capability' ? meta.protection.capability : undefined;
}

export type CurrentUser = {
  id: string;
  email: string;
  name?: string;
  role?: UserRole;
  tenantRoles?: TenantRole[];
  capabilities?: Capability[];
  tenantId?: string;
};

export function canAccess(meta: RouteMeta | undefined, user: CurrentUser | null): { allowed: boolean; reason?: string } {
  if (!meta?.protection || meta.protection.kind === 'public') return { allowed: true };
  if (meta.protection.kind === 'guest-only') return { allowed: true };
  if (!user) return { allowed: false, reason: 'authenticated_required' };

  if (meta.protection.kind === 'authenticated') return { allowed: true };

  if (meta.protection.kind === 'role') {
    if (user.role === meta.protection.role) return { allowed: true };
    if (user.role === 'ADMIN') return { allowed: true };
    return { allowed: false, reason: `role_required:${meta.protection.role}` };
  }

  if (meta.protection.kind === 'tenant-role') {
    const tenantRoles = user.tenantRoles || [];
    if (tenantRoles.some(r => meta.protection.tenantRoles.includes(r))) return { allowed: true };
    if (user.role === 'ADMIN') return { allowed: true };
    return { allowed: false, reason: 'tenant_role_required' };
  }

  if (meta.protection.kind === 'capability') {
    const caps = user.capabilities || [];
    if (caps.includes(meta.protection.capability)) return { allowed: true };
    if (user.role === 'ADMIN') return { allowed: true };
    return { allowed: false, reason: `capability_required:${meta.protection.capability}` };
  }

  return { allowed: false, reason: 'unknown_protection' };
}

export function isProtected(meta: RouteMeta | undefined): boolean {
  if (!meta?.protection) return false;
  return meta.protection.kind !== 'public' && meta.protection.kind !== 'guest-only';
}

export function nextRouteForUser(target: RouteLocationNormalized, user: CurrentUser | null): string | null {
  const meta: RouteMeta | undefined = target.meta as RouteMeta | undefined;
  const check = canAccess(meta, user);
  if (check.allowed) return null;
  if (check.reason === 'authenticated_required' || !user) return '/login';
  if (check.reason?.startsWith('role_required')) return '/learn/profile/dashboard';
  if (check.reason?.startsWith('capability_required')) return '/review';
  return '/';
}

const AUTHENTICATED: PageProtection = { kind: 'authenticated' };
const STUDIO_ROLES: TenantRole[] = ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'];

const GUARDED_AREAS: ReadonlyArray<readonly [string, PageProtection]> = [
  ['/admin', { kind: 'role', role: 'ADMIN' }],
  ['/reviewer', { kind: 'capability', capability: 'REVIEWER' }],
  ['/review', { kind: 'capability', capability: 'REVIEWER' }],
  ['/studio', { kind: 'tenant-role', tenantRoles: STUDIO_ROLES }],
  ['/marketplace/creator', AUTHENTICATED],
  ['/learn/profile', AUTHENTICATED],
  ['/learn/orders', AUTHENTICATED],
  ['/learn/achievements', AUTHENTICATED],
  ['/learn/support', AUTHENTICATED],
  ['/learn/leaderboard', AUTHENTICATED],
  ['/learn/streaks', AUTHENTICATED],
  ['/my-learning', AUTHENTICATED],
  ['/teacher', AUTHENTICATED],
  ['/student', AUTHENTICATED],
  ['/wallet', AUTHENTICATED],
  ['/checkout', AUTHENTICATED],
  ['/credits', AUTHENTICATED],
  ['/onboarding', AUTHENTICATED],
  ['/simulator', AUTHENTICATED],
  ['/sandbox', AUTHENTICATED],
  ['/notifications', AUTHENTICATED],
  ['/profile', AUTHENTICATED],
  ['/skill-tree', AUTHENTICATED],
  ['/tutor', AUTHENTICATED],
  ['/become-creator', AUTHENTICATED],
];

const GUARDED_PATTERNS: ReadonlyArray<readonly [RegExp, PageProtection]> = [
  [/^\/learn\/topics\/[^/]+\/order$/, AUTHENTICATED],
];

const underPrefix = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function resolveProtection(path: string, declared: PageProtection | undefined): PageProtection | undefined {
  if (declared) return declared;
  const area = GUARDED_AREAS.find(([prefix]) => underPrefix(path, prefix));
  if (area) return area[1];
  return GUARDED_PATTERNS.find(([pattern]) => pattern.test(path))?.[1];
}

export const SIGNED_IN_HOME = '/learn/profile/dashboard';

export function resolveNavigation(
  protection: PageProtection | undefined,
  user: CurrentUser | null,
): { redirect: string } | null {
  if (protection?.kind === 'guest-only' && user) return { redirect: SIGNED_IN_HOME };
  const access = canAccess(protection ? { protection } : undefined, user);
  if (access.allowed) return null;
  return { redirect: user ? '/' : '/login' };
}
