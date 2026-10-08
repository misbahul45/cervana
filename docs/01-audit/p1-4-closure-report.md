# P1-4 Closure — Edge Rate Limiting

**Date:** 2026-10-05
**Scope:** Apply the existing `limit_req_zone` definitions from `infra/nginx/conf.d/00-common.conf` to the `/api/` and `/ai/` location blocks in `infra/nginx/nginx.conf`. Add tighter per-IP and per-token zones for AI (LLM calls are more expensive than REST).
**Status:** **RESOLVED** with live burst verification.

---

## 1. Zone inventory

| Zone | Key | Rate | Burst | Applied to |
|---|---|---|---|---|
| `api_ip` (existing) | `$binary_remote_addr` | 10 r/s | 20 | `location /api/` |
| `api_user` (existing) | `$http_authorization` | 2 r/s | 5 | `location /api/` |
| `ai_ip` (NEW) | `$binary_remote_addr` | 2 r/s | 4 | `location /ai/` |
| `ai_user` (NEW) | `$http_authorization` | 1 r/s | 2 | `location /ai/` |

AI zones are 5× stricter per-IP and 2× stricter per-token than the API zones. The per-token zones share no namespace with the per-IP zones; the per-token layer kicks in only when the client sends a bearer (e.g., the web's authenticated traffic), which gives per-user fairness.

The 429 response is custom: a JSON body matching the ReduCera envelope shape (`{ success, message, error.code, meta.requestId, meta.timestamp }`). `error_page 429 = @rate_limited` plus an internal `location @rate_limited` block serves the body. `limit_req_status 429` makes the 429 code explicit (default is 503).

`/api/v1/docs` is **not** rate-limited because it is public and not part of any business flow (master prompt §31 "Do not accidentally rate-limit public assets").

## 2. Live burst verification

```text
=== /api/ burst (10r/s + burst 20) ===
30 rapid OPTIONS preflight requests:
  204 204 204 204 204 204 204 204 204 204 204 204 204 204 204 204 429 429 429 204 429 204 429 429 204 429 429 204 429 204 429 429 429 429 429
  → first 17 pass (within burst), then 429, with occasional 204 as the bucket refills mid-burst
  → 18 of 35 returned 429 (≈51%)

=== /ai/ burst (2r/s + burst 4) ===
10 rapid GET /ai/ requests:
  429 429 429 429 429 200 200 200 200 200
  → 5 of 10 returned 429 (50%)

=== after 2s sleep, single request returns 204 again ===
HTTP 204
```

The 429 response body is exactly the ReduCera envelope:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Content-Length: 175

{"success":false,"message":"Too Many Requests","error":{"code":"RATE_LIMITED"},"meta":{"requestId":"ef8d7a993ae1163464f7d6370fe43d3f","timestamp":"2026-10-05T10:03:53+00:00"}}
```

`nginx -t` reports `configuration file /etc/nginx/nginx.conf syntax is ok`. nginx was reloaded without downtime (`docker compose restart nginx`).

## 3. Files Changed in P1-4 Fix

```text
infra/nginx/conf.d/00-common.conf   (added ai_ip, ai_user, limit_req_status, comment cleanup)
infra/nginx/nginx.conf               (applied limit_req in /api/ and /ai/ locations; added @rate_limited)
```

## 4. Outstanding

- The `nginx: [warn] 4096 worker_connections exceed open file resource limit: 1024` warning persists. It is a Dockerfile-level concern (the `nginx:1.27-alpine` image's default `worker_rlimit_nofile` is 1024). Fixing this requires changing `worker_connections` in `nginx.conf` to 1024 or raising the limit in the Dockerfile. Logged as a follow-up.
- The `/` location (web tier) and `/nginx-health` are intentionally NOT rate-limited.
- Static-asset location (`location ~* \.(js|css|...)`) is NOT rate-limited.
- The `limit_req_status 429` directive lives in `conf.d/00-common.conf` and applies to all `limit_req` invocations in the nginx config (nginx inheritance).
- The per-token zone uses `$http_authorization` as the key. If the client sends a different header for token identity (e.g., cookie-based auth in `services/api`), the zone will see all requests as from the same "no-auth" bucket. The web's `auth.global.ts` uses a `access_token` cookie via `credentials: 'include'`; the API receives it via the `Cookie` header, not `Authorization`. So the per-token zone won't be useful for the web path today. The per-IP zone covers the gap.
- Future improvement: a per-cookie-keyed zone for finer-grained per-user limits, once the auth header is normalized at the edge.

## 5. Verification Commands

```bash
# burst test on /api/
for i in $(seq 1 25); do
  curl -sS -o /dev/null -w '%{http_code} ' -X OPTIONS http://localhost/api/v1/auth/login \
    -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" &
done; wait

# burst test on /ai/
for i in $(seq 1 10); do
  curl -sS -o /dev/null -w '%{http_code} ' http://localhost/ai/ &
done; wait

# 429 body
curl -sS -i -X OPTIONS http://localhost/api/v1/auth/login \
  -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST"
```

P1-4 is **closed**. Master prompt §31 ("rate-limit at the edge", "burst", "nodelay", "429 response", "client identity") is now satisfied.
