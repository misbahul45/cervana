import { AuthService } from '@/v1/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SessionRepo } from '@/v1/auth/sessions.repo';

describe('refresh-token-reuse (Phase 0)', () => {
  let service: AuthService;
  let jwt: { verifyAsync: jest.Mock; signAsync: jest.Mock };
  let sessionRepo: { findSessionByToken: jest.Mock; deleteSession: jest.Mock };
  let userService: { findOne: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn(), signAsync: jest.fn() };
    sessionRepo = {
      findSessionByToken: jest.fn(),
      deleteSession: jest.fn(),
    };
    (sessionRepo as any).createSession = jest.fn().mockResolvedValue({ id: 's-2' });
    (sessionRepo as any).revokeAllUserSessions = jest.fn();
    userService = { findOne: jest.fn() };
    config = { get: jest.fn() };
    config.get.mockImplementation((key: string) => {
      if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret-test';
      if (key === 'JWT_ACCESS_SECRET') return 'access-secret-test';
      return undefined;
    });
    service = new AuthService(
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      sessionRepo as unknown as SessionRepo,
      userService as any,
      {} as any,
    );
  });

  it('rejects an already-revoked session token', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'u-1',
      type: 'refresh',
      sessionToken: 'session-revoked',
    });
    sessionRepo.findSessionByToken.mockResolvedValue(null);

    await expect(service.refreshTokens('any.token.value')).rejects.toThrow();

    expect(sessionRepo.findSessionByToken).toHaveBeenCalledWith('session-revoked');
    expect(sessionRepo.deleteSession).not.toHaveBeenCalled();
  });

  it('rejects an expired session token', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'u-1',
      type: 'refresh',
      sessionToken: 'session-expired',
    });
    sessionRepo.findSessionByToken.mockResolvedValue({
      id: 's-1',
      userId: 'u-1',
      sessionToken: 'session-expired',
      expires: new Date(Date.now() - 60_000),
    });

    await expect(service.refreshTokens('any.token.value')).rejects.toThrow();
  });

  it('accepts a valid refresh token and rotates the session', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'u-1',
      type: 'refresh',
      sessionToken: 'session-active',
    });
    sessionRepo.findSessionByToken.mockResolvedValue({
      id: 's-1',
      userId: 'u-1',
      sessionToken: 'session-active',
      expires: new Date(Date.now() + 60_000),
    });
    userService.findOne.mockResolvedValue({ id: 'u-1', isActive: true });
    jwt.signAsync
      .mockResolvedValueOnce('new-access-token')
      .mockResolvedValueOnce('new-refresh-token');

    const result = await service.refreshTokens('valid.token');

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(sessionRepo.deleteSession).toHaveBeenCalledWith('session-active');
  });
});