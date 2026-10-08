import { describe, expect, it } from 'vitest';
import { resolveNavigation, resolveProtection, type CurrentUser, type PageProtection } from '~/lib/route-meta';

const student: CurrentUser = { id: 'u1', email: 's@x.test', role: 'STUDENT', tenantRoles: [], capabilities: [] };
const creator: CurrentUser = {
  id: 'u2',
  email: 'c@x.test',
  role: 'STUDENT',
  tenantRoles: ['OWNER'],
  capabilities: ['CREATOR'],
};
const reviewer: CurrentUser = { id: 'u3', email: 'r@x.test', role: 'REVIEWER', tenantRoles: [], capabilities: ['REVIEWER'] };
const admin: CurrentUser = { id: 'u4', email: 'a@x.test', role: 'ADMIN', tenantRoles: [], capabilities: ['ADMIN'] };

describe('resolveNavigation', () => {
  it('lets a signed-in user browse a public page such as the marketplace', () => {
    expect(resolveNavigation({ kind: 'public' }, student)).toBeNull();
  });

  it('sends a signed-in user away from guest-only pages such as login', () => {
    expect(resolveNavigation({ kind: 'guest-only' }, student)).toEqual({ redirect: '/learn/profile/dashboard' });
  });

  it('lets a guest open guest-only and public pages', () => {
    expect(resolveNavigation({ kind: 'guest-only' }, null)).toBeNull();
    expect(resolveNavigation({ kind: 'public' }, null)).toBeNull();
  });

  it('sends a guest to login for authenticated pages', () => {
    expect(resolveNavigation({ kind: 'authenticated' }, null)).toEqual({ redirect: '/login' });
  });

  it('sends a signed-in user without the role home', () => {
    expect(resolveNavigation({ kind: 'role', role: 'ADMIN' }, student)).toEqual({ redirect: '/' });
  });

  it('admits a tenant member whose roles come from the API session', () => {
    const studio: PageProtection = { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] };
    expect(resolveNavigation(studio, creator)).toBeNull();
    expect(resolveNavigation(studio, student)).toEqual({ redirect: '/' });
  });

  it('admits a reviewer by capability and lets an admin through everything', () => {
    const review: PageProtection = { kind: 'capability', capability: 'REVIEWER' };
    expect(resolveNavigation(review, reviewer)).toBeNull();
    expect(resolveNavigation(review, student)).toEqual({ redirect: '/' });
    expect(resolveNavigation(review, admin)).toBeNull();
  });

  it('allows pages that declare nothing', () => {
    expect(resolveNavigation(undefined, null)).toBeNull();
  });
});

describe('resolveProtection', () => {
  it('keeps a protection the page declared itself', () => {
    const declared: PageProtection = { kind: 'public' };
    expect(resolveProtection('/admin/users', declared)).toBe(declared);
  });

  it.each([
    ['/admin/analytics', { kind: 'role', role: 'ADMIN' }],
    ['/admin', { kind: 'role', role: 'ADMIN' }],
    ['/reviewer/moderation', { kind: 'capability', capability: 'REVIEWER' }],
    ['/studio/earnings', { kind: 'tenant-role', tenantRoles: ['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'] }],
    ['/wallet', { kind: 'authenticated' }],
    ['/checkout/abc', { kind: 'authenticated' }],
    ['/my-learning/lessons/1', { kind: 'authenticated' }],
    ['/learn/orders/9/pay', { kind: 'authenticated' }],
    ['/learn/topics/slug/order', { kind: 'authenticated' }],
    ['/marketplace/creator/earnings', { kind: 'authenticated' }],
  ])('guards %s when the page declares nothing', (path, expected) => {
    expect(resolveProtection(path, undefined)).toEqual(expected);
  });

  it.each(['/', '/login', '/marketplace', '/marketplace/classes/x', '/creators/1', '/learn/topics/slug/detail', '/administrator'])(
    'leaves %s open',
    (path) => {
      expect(resolveProtection(path, undefined)).toBeUndefined();
    },
  );
});
