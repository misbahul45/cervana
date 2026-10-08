jest.mock('@arcjet/nest', () => ({
  ARCJET: 'ARCJET',
  fixedWindow: jest.fn(),
  shield: jest.fn(),
  ArcjetModule: { forRoot: jest.fn() },
}));

import { AuthController } from '@/v1/auth/auth.controller';

const issued = { accessToken: 'access-jwt', refreshToken: 'refresh-jwt', sessionToken: 'session-1' };

const buildController = () => {
  const authService = {
    verifyRefreshToken: jest.fn().mockResolvedValue({ sub: 'u-1', email: 'a@b.test', role: 'STUDENT' }),
    generateTokens: jest.fn().mockResolvedValue(issued),
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const arcjet: any = {
    withRule: jest.fn().mockReturnThis(),
    protect: jest.fn().mockResolvedValue({ isDenied: () => false }),
  };
  const controller = new AuthController(authService as any, config as any, arcjet);
  return { controller, authService };
};

const request = () => ({ cookies: { refresh_token: 'incoming-refresh' }, headers: {} }) as any;
const response = () => ({ cookie: jest.fn() }) as any;

describe('AuthController.refresh response contract', () => {
  it('returns the new refresh token in the body, not the access token', async () => {
    const { controller } = buildController();

    const result = await controller.refresh(request(), response());

    expect(result.data.access_token).toBe('access-jwt');
    expect(result.data.refresh_token).toBe('refresh-jwt');
    expect(result.data.refresh_token).not.toBe(result.data.access_token);
  });

  it('sets httpOnly cookies carrying the matching token values', async () => {
    const { controller } = buildController();
    const res = response();

    await controller.refresh(request(), res);

    const byName = Object.fromEntries(res.cookie.mock.calls.map((call: any[]) => [call[0], call]));
    expect(byName.access_token[1]).toBe('access-jwt');
    expect(byName.refresh_token[1]).toBe('refresh-jwt');
    expect(byName.access_token[2].httpOnly).toBe(true);
    expect(byName.refresh_token[2].httpOnly).toBe(true);
  });
});
