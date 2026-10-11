jest.mock('@arcjet/nest', () => ({
  ARCJET: 'ARCJET',
  fixedWindow: jest.fn(),
  shield: jest.fn(),
  ArcjetModule: { forRoot: jest.fn() },
}));

import { BadRequestException, HttpException } from '@nestjs/common';
import { AuthController } from '@/v1/auth/auth.controller';

const issued = { accessToken: 'access-jwt', refreshToken: 'refresh-jwt', sessionToken: 'session-1' };

const buildController = (env: Record<string, string> = {}) => {
  const authService = {
    refreshTokens: jest.fn().mockResolvedValue(issued),
    generateTokens: jest.fn().mockResolvedValue(issued),
    login: jest.fn().mockResolvedValue({ sub: 'u-1', email: 'a@b.test', role: 'STUDENT' }),
    register: jest.fn().mockResolvedValue({ message: 'ok', data: { id: 'u-1', email: 'a@b.test' } }),
    verifyOTP: jest.fn().mockResolvedValue({ message: 'ok', data: null }),
    resetPassword: jest.fn().mockResolvedValue({ message: 'ok', data: null }),
    requestPasswordReset: jest.fn().mockResolvedValue(undefined),
    resendOtp: jest.fn().mockResolvedValue(undefined),
    revokeSessionOf: jest.fn().mockResolvedValue(undefined),
  };
  const config = { get: jest.fn((key: string) => env[key]) };
  const arcjet: any = {
    withRule: jest.fn().mockReturnThis(),
    protect: jest.fn().mockResolvedValue({ isDenied: () => false }),
  };
  const controller = new AuthController(authService as any, config as any, arcjet);
  return { controller, authService, arcjet };
};

const request = (extra: Record<string, unknown> = {}) =>
  ({ cookies: { refresh_token: 'incoming-refresh' }, headers: {}, ...extra }) as any;
const response = () => ({ cookie: jest.fn(), clearCookie: jest.fn() }) as any;

describe('AuthController.refresh', () => {
  it('rotates the session through the service instead of minting a second one beside the old one', async () => {
    const { controller, authService } = buildController();

    await controller.refresh(request(), response());

    expect(authService.refreshTokens).toHaveBeenCalledWith('incoming-refresh');
    expect(authService.generateTokens).not.toHaveBeenCalled();
  });

  it('accepts the refresh token from the x-refresh-token header when there is no cookie', async () => {
    const { controller, authService } = buildController();

    await controller.refresh({ cookies: {}, headers: { 'x-refresh-token': 'header-refresh' } } as any, response());

    expect(authService.refreshTokens).toHaveBeenCalledWith('header-refresh');
  });

  it('returns the new refresh token in the body, not the access token', async () => {
    const { controller } = buildController();

    const result = await controller.refresh(request(), response());

    expect(result.data.access_token).toBe('access-jwt');
    expect(result.data.refresh_token).toBe('refresh-jwt');
    expect(result.data.refresh_token).not.toBe(result.data.access_token);
  });

  it('sets httpOnly Lax cookies carrying the matching token values', async () => {
    const { controller } = buildController({ NODE_ENV: 'production' });
    const res = response();

    await controller.refresh(request(), res);

    const byName = Object.fromEntries(res.cookie.mock.calls.map((call: any[]) => [call[0], call]));
    expect(byName.access_token[1]).toBe('access-jwt');
    expect(byName.refresh_token[1]).toBe('refresh-jwt');
    for (const name of ['access_token', 'refresh_token']) {
      expect(byName[name][2]).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: true, path: '/' });
    }
  });

  it('refuses a request with no refresh token at all', async () => {
    const { controller } = buildController();

    await expect(controller.refresh({ cookies: {}, headers: {} } as any, response())).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AuthController.login', () => {
  it('sets the cookies and keeps returning the tokens in the body for existing clients', async () => {
    const { controller } = buildController();
    const res = response();

    const result = await controller.login({ email: 'a@b.test', password: 'x' }, request(), res);

    expect(res.cookie).toHaveBeenCalledTimes(2);
    expect(result.data).toMatchObject({ id: 'u-1', access_token: 'access-jwt', refresh_token: 'refresh-jwt' });
  });
});

describe('AuthController.logout', () => {
  it('revokes the session behind the access cookie and clears both cookies with matching options', async () => {
    const { controller, authService } = buildController({ NODE_ENV: 'production', COOKIE_DOMAIN: 'reducera.test' });
    const res = response();

    await controller.logout(request({ cookies: { access_token: 'access-cookie' } }), res);

    expect(authService.revokeSessionOf).toHaveBeenCalledWith('access-cookie');
    const cleared = res.clearCookie.mock.calls.map((call: any[]) => call[0]).sort();
    expect(cleared).toEqual(['access_token', 'refresh_token']);
    expect(res.clearCookie.mock.calls[0][1]).toMatchObject({ httpOnly: true, sameSite: 'lax', domain: 'reducera.test' });
  });

  it('falls back to the bearer header when the client holds no cookie', async () => {
    const { controller, authService } = buildController();

    await controller.logout({ cookies: {}, headers: { authorization: 'Bearer from-header' } } as any, response());

    expect(authService.revokeSessionOf).toHaveBeenCalledWith('from-header');
  });
});

describe('AuthController password recovery', () => {
  it('answers a reset request the same way whatever the service found, so the response reveals nothing', async () => {
    const { controller, authService } = buildController();

    const known = await controller.forgotPassword({ email: 'known@b.test' }, request());
    const unknown = await controller.forgotPassword({ email: 'ghost@b.test' }, request());

    expect(authService.requestPasswordReset).toHaveBeenCalledWith('known@b.test');
    expect(authService.requestPasswordReset).toHaveBeenCalledWith('ghost@b.test');
    expect(known).toEqual(unknown);
    expect(known).toEqual({ message: expect.any(String), data: null });
  });

  it('resends the kind of code that was asked for, and answers uniformly', async () => {
    const { controller, authService } = buildController();

    const first = await controller.resendToken({ email: 'a@b.test' }, request(), { type: 'pw' });
    const second = await controller.resendToken({ email: 'ghost@b.test' }, request(), { type: 'email' });

    expect(authService.resendOtp).toHaveBeenCalledWith('a@b.test', 'pw');
    expect(authService.resendOtp).toHaveBeenCalledWith('ghost@b.test', 'email');
    expect(first).toEqual(second);
  });
});

describe('AuthController rate limiting', () => {
  const denied = () => {
    const parts = buildController();
    parts.arcjet.protect.mockResolvedValue({ isDenied: () => true });
    return parts;
  };

  const attempts: Array<[string, (controller: AuthController) => Promise<unknown>]> = [
    ['register', (c) => c.register({ name: 'A', email: 'a@b.test', password: 'long-enough-1', confirmPassword: 'long-enough-1' }, request())],
    ['login', (c) => c.login({ email: 'a@b.test', password: 'x' }, request(), response())],
    ['verify-email', (c) => c.verifyEmail({ identifier: 'a@b.test', otp: '123456' }, request())],
    ['forgot-password', (c) => c.forgotPassword({ email: 'a@b.test' }, request())],
    ['resend-token', (c) => c.resendToken({ email: 'a@b.test' }, request(), { type: 'email' })],
    ['refresh-token', (c) => c.refresh(request(), response())],
    ['reset-password', (c) => c.resetPassword({ identifier: 'a@b.test', otp: '123456', newPassword: 'brand-new-1', confirmPassword: 'brand-new-1' }, request())],
  ];

  it.each(attempts)('answers 429 on %s when Arcjet denies the caller, without reaching the service', async (_name, call) => {
    const { controller, authService } = denied();

    await expect(call(controller)).rejects.toMatchObject({ status: 429 });
    await expect(call(controller)).rejects.toBeInstanceOf(HttpException);
    for (const fn of Object.values(authService)) expect(fn).not.toHaveBeenCalled();
  });
});
