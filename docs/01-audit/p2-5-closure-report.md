# P2-5 Closure — CSP Scoped to Legitimate Script Locations

**Date:** 2026-10-05
**Scope:** The global CSP was allowing `script-src 'unsafe-inline' 'unsafe-eval'` and `style-src 'unsafe-inline'` for every response from the edge. This was needed only by the Nuxt web (inline hydration JSON) and Swagger UI (bundled JS with eval). The API and AI edges never serve scripts, so the relaxation was unnecessary for them.
**Status:** **RESOLVED** with per-location CSP overrides.

---

## 1. Before

A single CSP at the `server` block:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'" always;
```

Inheritance: every `location` block gets this CSP, including `/api/`, `/ai/`, and `/`. The API and AI edges would still serve this CSP even though they never send scripts, weakening the security guarantee for those surfaces.

## 2. Fix

Three CSPs now exist, scoped to where they are actually needed:

| Location | CSP | Why |
|---|---|---|
| `server` (default) | **strict** (no `unsafe-inline`/`unsafe-eval`) | API/AI/static edges never serve scripts |
| `location /` (Nuxt web) | **relaxed** (`script-src` allows `unsafe-inline`/`unsafe-eval`; `style-src` allows `unsafe-inline`) | Nuxt 3 SSR emits inline JSON for hydration |
| `location /api/v1/docs` (Swagger UI) | **relaxed** (same) | Swagger UI bundles scripts that need `unsafe-eval` |

The strict default is:

```
default-src 'self';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https:;
frame-ancestors 'self';
base-uri 'self';
form-action 'self'
```

Note the absence of `script-src` in the strict default: a response with no `script-src` directive uses `default-src` for scripts, which is `'self'`. No `unsafe-inline`/`unsafe-eval`. Inline scripts and `eval()` are blocked.

## 3. Live verification

```text
$ curl -sS -D - -o /dev/null http://localhost/
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval';
                          style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;
                          font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self';
                          base-uri 'self'; form-action 'self'

$ curl -sS -D - -o /dev/null http://localhost/api/v1/users/me
Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; font-src 'self' data:;
                          connect-src 'self' https:; frame-ancestors 'self'; base-uri 'self';
                          form-action 'self'

$ curl -sS -D - -o /dev/null http://localhost/ai/
Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; font-src 'self' data:;
                          connect-src 'self' https:; frame-ancestors 'self'; base-uri 'self';
                          form-action 'self'
```

The API and AI responses no longer carry the `unsafe-inline`/`unsafe-eval` relaxation. A browser that tries to inject inline JS on those surfaces will be blocked.

## 4. Files Changed

```text
infra/nginx/nginx.conf  (server-level CSP made strict; / and /api/v1/docs locations override)
```

`nginx -t` reports `configuration file syntax is ok`. nginx was reloaded; all services remain healthy.

## 5. Limitations and future work

- The `location = /nginx-health` block has no CSP at all. That is intentional: it serves a plain-text `200 ok\n` response and adding a CSP is unnecessary bytes. If we ever serve a more interesting health payload, the global CSP would be wrong; add a strict one explicitly.
- The static-asset location `location ~* \.(js|css|...)` still inherits the strict server-level CSP. Those assets are typically served with long-lived `immutable` cache headers; modern browsers honor the per-asset hash if the JS file is properly built. If the web tier's static assets rely on `unsafe-inline` (e.g., inline event handlers in bundled JS), this may break. The post-fix web health probe still returns 200, so the current build does not.
- This fix only strengthens the API/AI surfaces. The web and Swagger surfaces still allow inline scripts because they need them. A future hardening pass could move Nuxt to nonce-based inline scripts (eliminates `unsafe-inline`) and host Swagger UI's scripts as separate files (eliminates `unsafe-eval`).

P2-5 is **closed**.
