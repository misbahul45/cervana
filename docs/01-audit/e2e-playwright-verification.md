# E2E Playwright Verification — Full Pass

**Date:** 2026-10-07
**Method:** Playwright MCP against live stack (`docker compose ps`: 8/8 healthy). Seeded TEACHER user `e2e-test@reducera.local` via UI login (POST `/api/v1/auth/login` → 201, GET `/api/v1/auth/check` → 200). Screenshots in `.playwright-mcp/` (git-ignored).
**Scope:** login flow, topics list + detail (SPA), marketplace (public), admin dashboard (CSP + URL fix re-verify), viewport matrix 1280/768/375, dark mode, reduced-motion spot, a11y spot (lang/h1/main/overflow).

---

## 1. Login flow — PASS

```text
POST http://localhost/api/v1/auth/login => [201] Created
GET  http://localhost/api/v1/auth/check => [200] OK
Page URL after submit: http://localhost/learn/topics
```

Single-`/api/v1` paths confirmed (P1-2 normalize verified in browser). Before the fix this POST went to `/auth/login` (Nuxt 404 HTML).

## 2. Topics list + detail (SPA) — PASS

```text
GET /api/v1/categories?include=topics => 200
GET /api/v1/curriculum/topics?page=1&limit=10 => 200
GET /api/v1/learning/user-topics?...&topicId=... => 200 (×N)
GET /api/v1/curriculum/topics/topic-0abfe480 => 200
GET /api/v1/curriculum/subtopics?...&topicId=...&include=theme => 200
```

Topic Detail navigation via in-app Detail button works (client-side, no full reload). Screenshot: `e2e-topic-detail-1280-light.png`, `e2e-topic-detail-375-light.png`, `e2e-topic-detail-768-dark.png`.

## 3. Marketplace (public) — PASS

```text
GET /api/v1/categories?include=topics => 200
```

Renders real products (Jurnal Umum untuk Pemula, Double-Entry Mahir, Penyesuaian Ayat Jurnal Penutup, Skenario Rekonsiliasi Bank) with working filter comboboxes. Screenshot: `e2e-marketplace-1280-light.png`. Only console error: Nuxt hydration mismatch (pre-existing).

## 4. Admin dashboard — PASS (after two fixes)

Before: CSP `connect-src` blocked `http://localhost:3002/...` + hardcoded absolute URL + `/api/v1/v1/admin/backup` double-v1 404.
After:

```text
GET http://localhost/api/v1/admin/backup => [404] → [401/403 with auth after controller fix]
```

Controller `@Controller('v1/admin/backup')` → `@Controller('admin/backup')` as part of the 21-controller single-`v1` alignment. With TEACHER token: 403 (correct RBAC — backup is admin-only). CSP errors gone; request is same-origin.

## 5. Sandbox / gamify / wallet (API-verified)

21 `@Controller('v1/...')` → single form. Authenticated probes after api rebuild:

```text
/api/v1/sandbox/scenarios: 200
/api/v1/sandbox/graph: 200
/api/v1/gamify/badges/me: 200
/api/v1/gamify/level/me: 200
/api/v1/wallets/mine: 200
/api/v1/admin/backup: 403 (TEACHER, correct)
/api/v1/commerce/credit-packages: 200
/api/v1/personalization/mastery/me: 200
/api/v1/v1/admin/backup: 404 (double form gone)
/api/v1/v1/sandbox/scenarios: 404 (double form gone)
```

SandboxModule RouterModule self-nest removed; gamify badges/level controllers made relative (`badges`, `level`) with GamifyModule children flattened to `''`. Web `walletApi.me()` now calls `/api/v1/wallets/mine` and maps first wallet to `{balance, currency, recent: []}`.

Unit suite after all routing changes: 1214 passed, 5 skipped, 0 failed.

## 6. Matrix

| Page | 1280 light | 375 light | 768 dark | Reduced motion |
|---|---|---|---|---|
| `/` landing | shot `e2e-01` set (prev) + `e2e-11-landing-1280-dark.png`, `e2e-12-landing-375-dark.png`, `e2e-13-landing-768-dark.png` | overflow=false, lang=id, h1+main present, 11 focusables | dark shot | reduce spot on dashboard `e2e-14` |
| `/learn/topics` | `e2e-topics-1280-light.png` | — | — | — |
| topic detail | `e2e-topic-detail-1280-light.png` | `e2e-topic-detail-375-light.png` overflow=false, lang=id, h1+main | `e2e-topic-detail-768-dark.png` | — |
| `/marketplace` | `e2e-marketplace-1280-light.png` | — | — | — |
| `/admin/dashboard` | `e2e-admin-dashboard-1280-light-fixed.png` | — | — | — |

## 7. Console / network notes

- Nuxt hydration mismatch persists on every page (pre-existing, non-blocking).
- `https://example.test/t.png` ERR_NAME_NOT_RESOLVED ×N (seed placeholder image host; test-data issue, not code).
- No failed `/api/v1/...` requests after fixes except expected 401-before-login and 403-forbidden-by-role.
- Rate limiter observed live (429 on burst for teacher/eligibility + simulator) — P1-4 working.

## 8. Known limitation (documented, not fixed in this pass)

Full-page reload (`page.goto`) on `authenticated`-protected routes redirects to `/login` because the SSR `authService.check()` does not forward request cookies (it calls without tokens; server `fetch` sends no Cookie header). SPA navigation after UI login works. Fixing SSR cookie forwarding is a dedicated web change (read incoming cookies in middleware/server helper and pass as tokens). Recorded as follow-up; does not block the verified SPA flows.

## 9. Files changed in this E2E pass

```text
apps/web/app/pages/(auth)/login.vue (merged duplicate <script setup>)
apps/web/app/pages/(auth)/register.vue (merged duplicate <script setup>)
apps/web/app/middleware/auth.global.ts (removed stray <script setup> opener)
apps/web/app/lib/api.ts (normalizeApiPath + relative helpers)
apps/web/app/pages/admin/dashboard.vue (relative /api/v1/admin/backup)
apps/web/app/lib/api.ts walletApi (→ /api/v1/wallets/mine + shape map)
services/api 21 controllers (stripped v1/ prefix)
services/api sandbox.module (removed self-nesting RouterModule)
services/api gamify.module (flattened badges/level children)
services/api 2 spec files (updated controller-relative paths)
infra/nginx/nginx.conf (connect-src += localhost:3002/3003)
```

No `git add` / `git commit` performed.
