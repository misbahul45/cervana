jest.mock('@arcjet/nest', () => ({
  ARCJET: 'ARCJET',
  fixedWindow: jest.fn(),
  shield: jest.fn(),
  ArcjetModule: { forRoot: jest.fn() },
}));

import { Role, TenantRole } from '@prisma/client';
import { AuthController } from '@/v1/auth/auth.controller';
import { deriveSessionClaims } from '@/v1/auth/session-claims';

describe('deriveSessionClaims', () => {
  it('gives a plain student no tenant roles and no capabilities', () => {
    expect(deriveSessionClaims(Role.STUDENT, [])).toEqual({ tenantRoles: [], capabilities: [] });
  });

  it('deduplicates tenant roles across memberships', () => {
    const claims = deriveSessionClaims(Role.STUDENT, [
      { role: TenantRole.OWNER },
      { role: TenantRole.OWNER },
      { role: TenantRole.EDITOR },
    ]);

    expect(claims.tenantRoles).toEqual([TenantRole.OWNER, TenantRole.EDITOR]);
  });

  it('marks tenant members and teachers as creators', () => {
    expect(deriveSessionClaims(Role.STUDENT, [{ role: TenantRole.TEACHER }]).capabilities).toContain('CREATOR');
    expect(deriveSessionClaims(Role.TEACHER, []).capabilities).toContain('CREATOR');
  });

  it('maps reviewer and admin roles to their capabilities', () => {
    expect(deriveSessionClaims(Role.REVIEWER, []).capabilities).toEqual(['REVIEWER']);
    expect(deriveSessionClaims(Role.ADMIN, []).capabilities).toEqual(['ADMIN']);
  });

  it('never derives a capability from a student role alone', () => {
    const claims = deriveSessionClaims(Role.STUDENT, []);

    expect(claims.capabilities).not.toContain('ADMIN');
    expect(claims.capabilities).not.toContain('REVIEWER');
    expect(claims.capabilities).not.toContain('CREATOR');
  });
});

describe('AuthController.checkAuth', () => {
  const user = {
    id: 'u-1',
    email: 'a@b.test',
    name: 'A',
    role: Role.STUDENT,
    isActive: true,
    emailVerified: new Date(),
    image: null,
    provider: 'JWT',
  } as any;

  it('exposes tenantRoles and capabilities resolved by the auth service', async () => {
    const authService = {
      getSessionClaims: jest.fn().mockResolvedValue({ tenantRoles: ['OWNER'], capabilities: ['CREATOR'] }),
    };
    const controller = new AuthController(authService as any, { get: jest.fn() } as any, {} as any);

    const result = await controller.checkAuth(user);

    expect(authService.getSessionClaims).toHaveBeenCalledWith('u-1', Role.STUDENT);
    expect(result.data.authenticated).toBe(true);
    expect(result.data.user).toMatchObject({ id: 'u-1', tenantRoles: ['OWNER'], capabilities: ['CREATOR'] });
  });

  it('does not leak a password field', async () => {
    const authService = { getSessionClaims: jest.fn().mockResolvedValue({ tenantRoles: [], capabilities: [] }) };
    const controller = new AuthController(authService as any, { get: jest.fn() } as any, {} as any);

    const result = await controller.checkAuth({ ...user, password: 'hash' });

    expect(result.data.user).not.toHaveProperty('password');
  });
});
