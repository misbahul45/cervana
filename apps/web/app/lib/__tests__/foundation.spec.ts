import { describe, expect, it } from 'vitest';
import {
  canAccess,
  getRequiredCapability,
  getRequiredRole,
  getRequiredTenantRoles,
  isProtected,
  isPublic,
  nextRouteForUser,
  requiresAuthentication,
} from '~/lib/route-meta';
import { qk, QK } from '~/lib/query-keys';

const learner = {
  id: 'u1',
  email: 'a@b.c',
  role: 'STUDENT' as const,
  tenantRoles: [] as const[],
  capabilities: [] as const[],
};

const teacher = {
  id: 'u2',
  email: 't@b.c',
  role: 'TEACHER' as const,
  tenantRoles: ['OWNER', 'MANAGER', 'TEACHER'] as const[],
  capabilities: ['REVIEWER'] as const[],
};

const admin = {
  id: 'u3',
  email: 'admin@b.c',
  role: 'ADMIN' as const,
};

describe('route-meta (master prompt §8, §9, §10)', () => {
  it('public routes are recognized', () => {
    expect(isPublic({ protection: { kind: 'public' } })).toBe(true);
    expect(isPublic({ protection: { kind: 'guest-only' } })).toBe(true);
    expect(isPublic({ protection: { kind: 'authenticated' } })).toBe(false);
    expect(isPublic(undefined)).toBe(false);
  });

  it('protected routes are recognized', () => {
    expect(isProtected({ protection: { kind: 'authenticated' } })).toBe(true);
    expect(isProtected({ protection: { kind: 'role', role: 'TEACHER' } })).toBe(true);
    expect(isProtected({ protection: { kind: 'public' } })).toBe(false);
  });

  it('requiresAuthentication is consistent with isProtected', () => {
    expect(requiresAuthentication({ protection: { kind: 'authenticated' } })).toBe(true);
    expect(requiresAuthentication({ protection: { kind: 'public' } })).toBe(false);
  });

  it('getRequiredRole returns the role for role-protected routes', () => {
    expect(getRequiredRole({ protection: { kind: 'role', role: 'TEACHER' } })).toBe('TEACHER');
    expect(getRequiredRole({ protection: { kind: 'public' } })).toBeUndefined();
  });

  it('getRequiredTenantRoles returns the tenant roles', () => {
    expect(getRequiredTenantRoles({ protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER'] } })).toEqual(['OWNER', 'MANAGER']);
  });

  it('getRequiredCapability returns the capability', () => {
    expect(getRequiredCapability({ protection: { kind: 'capability', capability: 'REVIEWER' } })).toBe('REVIEWER');
  });

  it('canAccess allows unauthenticated public routes', () => {
    const r = canAccess({ protection: { kind: 'public' } }, null);
    expect(r.allowed).toBe(true);
  });

  it('canAccess denies unauthenticated protected routes', () => {
    const r = canAccess({ protection: { kind: 'authenticated' } }, null);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('authenticated_required');
  });

  it('canAccess allows correct role', () => {
    const r = canAccess({ protection: { kind: 'role', role: 'TEACHER' } }, teacher);
    expect(r.allowed).toBe(true);
  });

  it('canAccess denies wrong role (non-admin)', () => {
    const r = canAccess({ protection: { kind: 'role', role: 'TEACHER' } }, learner);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('role_required:TEACHER');
  });

  it('canAccess allows ADMIN to bypass role', () => {
    const r = canAccess({ protection: { kind: 'role', role: 'TEACHER' } }, admin);
    expect(r.allowed).toBe(true);
  });

  it('canAccess allows correct tenant role', () => {
    const r = canAccess(
      { protection: { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER'] } },
      teacher,
    );
    expect(r.allowed).toBe(true);
  });

  it('canAccess denies missing tenant role', () => {
    const r = canAccess(
      { protection: { kind: 'tenant-role', tenantRoles: ['OWNER'] } },
      learner,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('tenant_role_required');
  });

  it('canAccess allows correct capability', () => {
    const r = canAccess({ protection: { kind: 'capability', capability: 'REVIEWER' } }, teacher);
    expect(r.allowed).toBe(true);
  });

  it('canAccess denies missing capability', () => {
    const r = canAccess({ protection: { kind: 'capability', capability: 'REVIEWER' } }, learner);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('capability_required:REVIEWER');
  });

  it('nextRouteForUser sends to /login when unauthenticated', () => {
    expect(nextRouteForUser(
      { meta: { protection: { kind: 'authenticated' } } } as never,
      null,
    )).toBe('/login');
  });

  it('nextRouteForUser sends to / for wrong role', () => {
    const r = nextRouteForUser(
      { meta: { protection: { kind: 'role', role: 'ADMIN' } } } as never,
      learner,
    );
    expect(r).toBe('/learn/profile/dashboard');
  });
});

describe('query-keys (master prompt §5)', () => {
  it('qk flattens resource, scope, params into a single tuple', () => {
    const key = qk('orders', 'list', { status: 'paid', userId: 'u1' });
    expect(Array.isArray(key)).toBe(true);
    expect(key[0]).toBe('orders');
    expect(key).toContain('list');
    expect(key).toContain('status');
    expect(key).toContain('paid');
    expect(key).toContain('userId');
    expect(key).toContain('u1');
  });

  it('qk sorts dict keys deterministically', () => {
    const a = qk('a', { b: 1, a: 2 });
    const b = qk('a', { a: 2, b: 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('qk skips null/undefined', () => {
    expect(qk('a', null, undefined, 'b')).toEqual(['a', 'b']);
  });

  it('QK.learner.dashboard produces a stable key', () => {
    expect(QK.learner.dashboard()).toEqual(['learner', 'dashboard']);
  });

  it('QK.learner.mastery includes the topic id', () => {
    expect(QK.learner.mastery('topic-1')).toContain('topic-1');
  });

  it('QK.curriculum.lessons filters by topic id', () => {
    expect(QK.curriculum.lessons('topic-1')).toContain('topic-1');
  });
});