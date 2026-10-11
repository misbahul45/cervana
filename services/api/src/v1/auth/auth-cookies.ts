import type { CookieOptions } from 'express';

export const ACCESS_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface CookieEnvironment {
  production: boolean;
  domain?: string;
}

export const tokenCookieOptions = ({ production, domain }: CookieEnvironment): CookieOptions => ({
  httpOnly: true,
  secure: production,
  sameSite: 'lax',
  domain: domain || undefined,
  path: '/',
});
