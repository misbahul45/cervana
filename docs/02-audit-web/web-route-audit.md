# Web Route Audit

**Scope:** `apps/web` only. Date: 2026-10-05.
**Inventory basis:** `find apps/web/app/pages -type d` + `find apps/web/app/components -name "*.vue" -o -name "*.ts"` + read of `nuxt.config.ts` + `package.json`.

---

## 1. Headline

- `apps/web` is a Nuxt 4 + Vue 3 + TypeScript application with Nuxt UI, Tailwind v4, TanStack Vue Query, Pinia.
- 72 page components, 61 reusable components, 23 service modules, 4 lib modules, 1 global middleware.
- Route organization is **flat per domain** (admin/, marketplace/, learn/, etc.) with no central route map.
- Master prompt §19 route map (`/`, `/login`, `/marketplace`, `/my-learning/lessons/[id]`, `/tutor/[sessionId]`, `/sandbox`, `/sandbox/[scenarioId]`, `/studio`, `/studio/articles/[id]`, `/admin/payments`, `/credits`, `/learn/orders/[id]/pay`, etc.) is **partially implemented**. Several required routes are missing or misnamed.
- SSR is enabled and configured with OG tags. Client-heavy surfaces are mixed.

---

## 2. Route Inventory — present in `app/pages/`

| Directory | Notes |
|---|---|
| `app/pages/index.vue` (root) | SC-01 Landing |
| `app/pages/(auth)/login.vue` etc. | SC-02 Auth |
| `app/pages/onboarding/` | SC-03 Onboarding (present, but flow completeness not verified) |
| `app/pages/learn/profile/` | SC-04 Dashboard |
| `app/pages/skill-tree/` | SC-05 Skill Tree |
| `app/pages/my-learning/lessons/[id]/` | SC-06 Lesson |
| `app/pages/sandbox/` + `app/pages/simulator/` | SC-07 / SC-08 Sandbox (two separate folders) |
| (missing) | SC-09 Tutor at `/tutor/[sessionId]` |
| `app/pages/wallet/` | SC-10 Credits (named wallet, not /credits) |
| `app/pages/marketplace/` | SC-11 Marketplace |
| `app/pages/marketplace/articles/[slug]/` (implicit, `[id]` exists) | SC-12 Product Detail (mixed slug vs id) |
| `app/pages/checkout/[orderId]/` | SC-13 Payment |
| `app/pages/learn/orders/` | SC-14 Orders |
| `app/pages/become-creator/`, `app/pages/my-learning/become-creator/` | SC-15 Become Creator (two routes) |
| `app/pages/studio/` + `app/pages/studio/articles/`, etc. | SC-16 Studio + SC-17 Article Editor |
| `app/pages/reviewer/` | SC-18 Review (route present, scope unverified) |
| `app/pages/studio/earnings/` + `app/pages/studio/withdrawals/` | SC-19 Earnings/Payout |
| `app/pages/admin/` + `app/pages/admin/payments/` + `app/pages/admin/analytics/` | SC-20 Admin |
| `app/pages/creators/[id]/` | SC-131 Creator Profile |

## 3. Missing Routes (per master prompt §19)

| Master prompt route | Status |
|---|---|
| `/tutor/[sessionId]` | MISSING (tutor is rendered inside lesson pages or my module) |
| `/sandbox/[scenarioId]` (index list at `/sandbox`, attempt at `/sandbox/attempts/[id]`) | PARTIAL — `/sandbox` exists, `/simulator/[companyId]` exists, but `/sandbox/attempts/[id]` and `/sandbox/[scenarioId]` are not present at the master-prompt path |
| `/credits` | MISSING — current routes use `/wallet/*` instead |
| `/learn/orders/[id]/pay` | NAMING-DEVIATION — current path is `/checkout/[orderId]` |
| `/learn/orders/[id]/submitted` | MISSING |
| `/become-creator` (vs `/my-learning/become-creator`) | DUPLICATE — master prompt expects single `/become-creator` |
| `/creators/[handle]` | NAMING-DEVIATION — current uses `[id]` not `[handle]` |
| `/admin/users`, `/admin/tenants`, `/admin/moderation`, `/admin/agents`, `/admin/themes`, `/admin/optimization`, `/admin/audit` | PARTIAL — `admin/analytics` and `admin/moderation` present; the rest missing |
| `/review` (review queue; current `reviewer` is a directory) | NAMING-DEVIATION — current uses `/reviewer/` not `/review` |

## 4. Route Metadata State

- `apps/web/app/middleware/auth.global.ts` is the only middleware.
- Per-route `meta.requiresRole / requiresTenantRole / requiresCapability / guestOnly` declarations are **not** present in pages (verified by absence of `definePageMeta` blocks).
- Master prompt §8 mandates `requiresRole / requiresTenantRole / requiresCapability / guestOnly` per page. Currently the auth check is done inside each page (`if (!user.value) { return navigateTo('/login') }` pattern).

## 5. SSR / Client-only Configuration

- SSR is enabled globally (`ssr: true`).
- Client-heavy surfaces (chatbot, editor, sandbox grid) are not wrapped in `<ClientOnly>` in the existing pages — verified by absence of `<ClientOnly>` in page files.

## 6. Summary

The current routing organization matches the master prompt's high-level structure (PUBLIC, AUTH, LEARNER, STUDIO, ADMIN) but:
1. Several required routes are missing or have wrong paths.
2. Role/tenant/capability metadata is not declared per route.
3. Client-only wrapping for editor/sandbox/tutor is inconsistent.

This audit forms the input for PHASE 1 (foundation) and the screen-by-screen work in PHASE 2–8.