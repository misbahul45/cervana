import type { CheckResponse, User } from '~/interfaces/auth';
import { authService } from '~/services/auth';
import { resolveNavigation, resolveProtection, type CurrentUser } from '~/lib/route-meta';

declare module '#app' {
  interface PageMeta {
    protection?: import('~/lib/route-meta').PageProtection;
    title?: string;
  }
}

interface AuthCheckError {
  message: string;
  status: number;
  at: number;
}

const NOT_SIGNED_IN = new Set([401, 403]);

export default defineNuxtRouteMiddleware(async (to) => {
  const user = useState<User | null>('user', () => null);
  const skipCheck = useState<boolean>('skipCheck', () => false);
  const lastAuthCheckError = useState<AuthCheckError | null>('lastAuthCheckError', () => null);

  const protection = resolveProtection(to.path, to.meta?.protection);
  const needsSession = protection !== undefined && protection.kind !== 'public' && protection.kind !== 'guest-only';

  if (needsSession && !user.value && !skipCheck.value) {
    const res = await authService.check();
    const status = res.meta?.statusCode ?? 0;

    if (res.success && (res.data as CheckResponse | null)?.authenticated) {
      user.value = (res.data as CheckResponse).user;
      lastAuthCheckError.value = null;
    } else if (res.success || NOT_SIGNED_IN.has(status)) {
      user.value = null;
      lastAuthCheckError.value = null;
    } else {
      lastAuthCheckError.value = { message: res.message, status, at: Date.now() };
      return abortNavigation(
        createError({ statusCode: status || 503, statusMessage: 'Layanan sedang tidak tersedia. Silakan coba lagi.' }),
      );
    }
  }

  const outcome = resolveNavigation(protection, user.value as unknown as CurrentUser | null);
  if (outcome) return navigateTo(outcome.redirect);
});
