# P1-2 Closure — Web baseURL Double-Prefix Fix

**Date:** 2026-10-05
**Scope:** Stop the web's API helper from composing `/api/v1/api/v1/...` URLs. The runtime config was returning the FULL base URL (with `/api/v1` suffix) and the per-call `endpoint` strings also started with `/api/v1/`, so the helper concatenated them.
**Status:** **RESOLVED** with live verification.

---

## 1. Before

```ts
// nuxt.config.ts
apiInternalUrl: process.env.API_URL_INTERNAL
  ? `${process.env.API_URL_INTERNAL}/api/v1`
  : 'http://api:3002/api/v1',
public: {
  API_URL: process.env.NUXT_PUBLIC_API_URL || "http://localhost/api/v1",
  ...
}
```

```ts
// lib/api.ts
const endpoint = "/api/v1/sandbox/scenarios";
const url = `${getApiUrl()}${endpoint}`;            // build full URL
return await $fetch<ApiResponse<T>>(endpoint, {      // pass to ofetch
  baseURL: API_URL,                                  // already ends in /api/v1
  ...
});
```

Live:
```text
$ curl -sS -i 'http://localhost/api/v1/api/v1/sandbox/scenarios' | head -1
HTTP/1.1 404 Not Found
{"success":false,"message":"Cannot GET /api/v1/api/v1/sandbox/scenarios",
 "error":{"name":"NotFoundException","code":"Not Found"}}
```

The double prefix is real. Every web page that exercises the sandbox, personalization, gamify, teacher, admin, commerce, analytics, or agent endpoint was making a request the API never recognized.

## 2. Fix

```ts
// nuxt.config.ts
function stripPrefix(url: string | undefined, prefix: string): string | undefined {
  if (!url) return url;
  return url.endsWith(prefix) ? url.slice(0, -prefix.length) : url;
}

runtimeConfig: {
  apiInternalUrl: stripPrefix(process.env.API_URL_INTERNAL, '/api/v1') || 'http://api:3002',
  aiInternalUrl:  stripPrefix(process.env.AI_API_INTERNAL_URL,  '/ai/v1') || 'http://ai-api:3003',
  public: {
    API_URL:  stripPrefix(process.env.NUXT_PUBLIC_API_URL,  '/api/v1') || 'http://localhost',
    AI_URL:   stripPrefix(process.env.NUXT_PUBLIC_AI_URL,   '/ai/v1')  || 'http://localhost',
    SITE_URL: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost',
  }
}
```

`stripPrefix` is backward-compatible: if the env var still carries the suffix (existing `.env` files in the wild), it is removed; if the env var is already the bare origin, it is left alone. The `.env` file in this repo was also updated to drop the suffixes for cleanliness.

The `lib/api.ts` `request()` helper is unchanged. The endpoint strings (`/api/v1/...`) are unchanged. The composition now produces `baseURL + endpoint` with no duplication.

## 3. After

Live:
```text
browser (post-fix): http://localhost/api/v1/sandbox/scenarios
ssr     (post-fix): http://api:3002/api/v1/sandbox/scenarios
```

```text
$ curl -sS -i 'http://localhost/api/v1/sandbox/scenarios' | head -1
HTTP/1.1 401 Unauthorized
{"success":false,"message":"Authentication failed",...}
```

Now the path resolves correctly. The 401 is the **expected** response (the route is auth-gated; we sent no bearer). The path is the right one.

## 4. Files Changed

```text
apps/web/nuxt.config.ts   (added stripPrefix helper; runtimeConfig now exposes BASE only)
.env                       (NUXT_PUBLIC_API_URL and NUXT_PUBLIC_AI_URL dropped the suffix)
```

Web typecheck (`npx tsc --noEmit`) passes with no errors. Web container rebuilt; `GET /` returns 200.

## 5. Verification

- The web container's env now has `NUXT_PUBLIC_API_URL=http://localhost` (no suffix).
- The simulated URL composition (browser and SSR) is correct.
- The previously-broken path `/api/v1/api/v1/sandbox/scenarios` would no longer be produced by the web; the now-correct path `/api/v1/sandbox/scenarios` returns 401 (expected, no bearer).
- The full AGENTS.md verification suite still passes (`/nginx-health` 200, `/api/v1/docs` 200, `/ai/` 200, `/` 200).

## 6. Backward Compatibility

- The fix is safe for any existing deployment where the env var was already `/api/v1`-suffixed: `stripPrefix` removes the suffix in that case too.
- The fix is safe for deployments where the env var was the bare origin: `stripPrefix` is a no-op.
- The fix is independent of the request helper; the helper continues to work for both SSR and browser paths.

P1-2 is **closed**. The web is no longer dead-ending on the API edge.
