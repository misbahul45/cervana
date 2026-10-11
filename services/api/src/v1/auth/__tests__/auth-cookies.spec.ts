import { ACCESS_COOKIE_MAX_AGE_MS, REFRESH_COOKIE_MAX_AGE_MS, tokenCookieOptions } from '@/v1/auth/auth-cookies';

describe('tokenCookieOptions', () => {
  it('is httpOnly and SameSite=Lax so a foreign site cannot ride the session', () => {
    const options = tokenCookieOptions({ production: true, domain: 'reducera.test' });

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/');
  });

  it('is Secure in production and not in development, where http://localhost has no TLS', () => {
    expect(tokenCookieOptions({ production: true }).secure).toBe(true);
    expect(tokenCookieOptions({ production: false }).secure).toBe(false);
  });

  it('carries the cookie domain only when one is configured', () => {
    expect(tokenCookieOptions({ production: true, domain: 'reducera.test' }).domain).toBe('reducera.test');
    expect(tokenCookieOptions({ production: true, domain: '' }).domain).toBeUndefined();
    expect(tokenCookieOptions({ production: true }).domain).toBeUndefined();
  });

  it('keeps the access cookie to one day and the refresh cookie to thirty', () => {
    expect(ACCESS_COOKIE_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
    expect(REFRESH_COOKIE_MAX_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
