import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '@/v1/auth/strategies/jwt.strategy';

const USER = { id: 'u-1', email: 'ayu@example.test', isActive: true, emailVerified: new Date('2026-01-01') };

const build = (options: { user?: unknown; session?: unknown } = {}) => {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue('user' in options ? options.user : USER) },
    session: {
      findUnique: jest.fn().mockResolvedValue(
        'session' in options ? options.session : { userId: 'u-1', expires: new Date(Date.now() + 60_000) },
      ),
    },
  };
  const config = { get: jest.fn().mockReturnValue('access-secret-for-tests') };
  const auth = { transformUserResponse: jest.fn((user: { id: string }) => ({ id: user.id, transformed: true })) };
  const strategy = new JwtStrategy(config as any, prisma as any, auth as any);
  return { strategy, prisma, auth };
};

const payload = { sub: 'u-1', email: 'ayu@example.test', role: 'STUDENT', sessionToken: 'session-1' } as any;

describe('JwtStrategy.validate', () => {
  it('accepts a token whose session still exists for that user', async () => {
    const { strategy, prisma } = build();

    await expect(strategy.validate(payload)).resolves.toEqual({ id: 'u-1', transformed: true });
    expect(prisma.session.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { sessionToken: 'session-1' } }));
  });

  it('rejects a token that carries no session at all', async () => {
    const { strategy } = build();

    await expect(strategy.validate({ ...payload, sessionToken: undefined })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token after its session was revoked by logout or a password reset', async () => {
    const { strategy } = build({ session: null });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token whose session belongs to somebody else', async () => {
    const { strategy } = build({ session: { userId: 'u-2', expires: new Date(Date.now() + 60_000) } });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token whose session has expired', async () => {
    const { strategy } = build({ session: { userId: 'u-1', expires: new Date(Date.now() - 1) } });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('still refuses a deactivated or unverified account', async () => {
    await expect(build({ user: { ...USER, isActive: false } }).strategy.validate(payload)).rejects.toMatchObject({ statusCode: 403 });
    await expect(build({ user: { ...USER, emailVerified: null } }).strategy.validate(payload)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('still refuses a token for an account that no longer exists', async () => {
    await expect(build({ user: null }).strategy.validate(payload)).rejects.toMatchObject({ statusCode: 404 });
  });
});
