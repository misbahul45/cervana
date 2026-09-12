import type { Handle } from '@sveltejs/kit';
import { authService } from '$lib/services/auth';
import { redirect } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const access_token = event.cookies.get('access_token');
  const refresh_token = event.cookies.get('refresh_token');

  try {
    if (access_token) {
      const res = await authService.check({ access_token, refresh_token });
      event.locals.user = res.data?.user ?? null;
    } else if (refresh_token) {
      const newTokens = await authService.refreshToken({ refresh_token });
      if (newTokens?.data?.access_token) {
        event.cookies.set('access_token', newTokens.data.access_token, {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 15 * 60 * 1000,
        });

        event.cookies.set("refresh_token", refresh_token, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: true,
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        const res = await authService.check({
          access_token: newTokens.data.access_token,
          refresh_token
        });
        event.locals.user = res.data?.user ?? null;
      } else {
        event.locals.user = null;
      }
    } else {
      event.locals.user = null;
    }
  } catch (error) {
    console.error('Auth error:', error);
    event.locals.user = null;
  }

  return resolve(event);
};
