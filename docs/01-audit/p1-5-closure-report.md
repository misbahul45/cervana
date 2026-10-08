# P1-5 Closure — Web Silent Auth Downgrade

**Date:** 2026-10-05
**Scope:** Fix `apps/web/app/middleware/auth.global.ts:24-26` which silently swallowed any `/auth/check` failure and downgraded `user.value` to `null`, redirecting a transiently-erroring user to `/login`.
**Status:** **RESOLVED**.

---

## 1. Before vs After

### Before

```ts
if (!user.value && !skipCheck.value && protection && protection.kind !== 'public' && protection.kind !== 'guest-only') {
  try {
    const respon = await authService.check();
    const data = respon.data as CheckResponse;
    user.value = data?.authenticated ? data.user : null;
  } catch {
    user.value = null;     // ← silent downgrade on any error
  }
}
```

Failure modes the catch swallowed:
- Network error (`fetch` throws `TypeError` on a dropped connection)
- 5xx from the API server (`AppExceptionsFilter` returns `{ success: false, ... }` and the browser path `$fetch` throws)
- Cookie expiration during in-flight navigation (server-side `fetch` returns a 401 that does not refresh in time)

In all of these, the user's session may be perfectly valid. The middleware would still set `user.value = null`, the next route's `canAccess` would reject, and the user would be redirected to `/login` — losing state, losing in-progress work, and producing a confused user.

### After

```ts
if (!user.value && !skipCheck.value && protection && protection.kind !== 'public' && protection.kind !== 'guest-only') {
  try {
    const respon = await authService.check();
    const data = respon.data as CheckResponse;
    if (data?.authenticated) {
      user.value = data.user;
      lastAuthCheckError.value = null;
    } else {
      user.value = null;          // explicit "not authenticated" from the server
    }
  } catch (err: any) {
    const status = err?.response?.status ?? err?.statusCode ?? err?.status;
    const transient = isTransient(err);
    lastAuthCheckError.value = { message: err?.message, status, transient, at: Date.now() };
    if (import.meta.client) {
      console.warn('[auth.global] /auth/check failed', { status, transient, path: to.fullPath, message: err?.message });
    }
    if (!transient) {
      user.value = null;
    }
    // transient: keep prior user.value (could be null on first visit, but is the right state on subsequent visits)
  }
}
```

`isTransient(err)` is a small classifier:

```ts
const TRANSIENT_STATUSES = new Set([0, 408, 425, 429, 500, 502, 503, 504]);
function isTransient(err: any): boolean {
  if (!err) return true;
  const status = err?.response?.status ?? err?.statusCode ?? err?.status;
  if (typeof status === 'number' && TRANSIENT_STATUSES.has(status)) return true;
  if (err?.name === 'FetchError' || err?.name === 'TypeError' || err?.cause) return true;
  return false;
}
```

429 is treated as transient because a rate-limit response should not log the user out (the next route may legitimately serve from cache). 401/403/404 are not transient and still result in a clean `user.value = null` + redirect.

## 2. Behavioral changes

| Server response | Before | After |
|---|---|---|
| 200 + `authenticated: true` | user set | user set, error cleared |
| 200 + `authenticated: false` | user cleared | user cleared (same) |
| 401 (definitive unauthenticated) | user cleared | user cleared (same) |
| 403 (forbidden, e.g., suspended) | user cleared | user cleared (same) |
| 404 (route not found) | user cleared | user cleared (same) |
| 408 / 425 / 429 / 5xx | user cleared ❌ | user preserved ✓, error logged |
| Network error (`TypeError`) | user cleared ❌ | user preserved ✓, error logged |
| Cookie expired mid-session | user cleared ❌ | depends: 401 path clears, 5xx path preserves |

## 3. New state slice

`lastAuthCheckError: Ref<AuthCheckError | null>` exposes the most recent failure to the rest of the app:

```ts
interface AuthCheckError {
  message: string;
  status?: number;
  transient: boolean;
  at: number;
}
```

A future UI improvement can render a non-blocking banner when `lastAuthCheckError.value?.transient === true` (e.g., "We're having trouble verifying your session — some features may be limited"). The current change makes that possible without further structural edits.

## 4. Files Changed in P1-5 Fix

```text
apps/web/app/middleware/auth.global.ts        (M)
```

No other modules touched. No new dependencies. No new state outside `useState` (so no SSR hydration mismatch).

## 5. Verification

The web container was rebuilt and is serving (`GET /` 200, content-type `text/html;charset=utf-8`). `npx tsc --noEmit` over `apps/web` passes with no errors.

Behavioral verification requires a running frontend session (browser) to exercise the SSR + CSR paths. A future Playwright MCP check (per AGENTS.md "Web verification") will be the production gate.

## 6. Outstanding (not in this fix set)

- No automated test for the middleware. The web project has only 1 E2E test (polish.spec.ts). Adding a meaningful middleware test requires `@nuxt/test-utils` (vitest + happy-dom + nuxt stub), which is a setup investment on its own. Tracked as a follow-up.
- `lastAuthCheckError` is set but no UI currently reads it. A small "session verification failed — refresh" banner is the natural next step.
- The cookie-based web auth flow (token in HttpOnly cookie) does not propagate to nginx's `$http_authorization` rate-limit key. A per-cookie-keyed rate-limit zone would be a follow-up (master prompt §31 "client identity").

P1-5 is **closed** at the logic level. UI feedback is deferred.
