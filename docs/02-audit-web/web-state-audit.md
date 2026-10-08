# Web State Management Audit

**Scope:** `apps/web/app/stores/**` + `apps/web/app/composables/**` + usages in pages. Date: 2026-10-05.

## 1. Headline

- TanStack Vue Query (`@tanstack/vue-query`) is integrated via `@peterbud/nuxt-query` and is the recommended server-state mechanism (master prompt §4 / §5).
- Pinia is used for UI / ephemeral state only.
- Master prompt §4 prohibits putting API entities into Pinia unless they are session, current tenant, or UI state.
- Master prompt §5 mandates a single query-key convention: `[resource, scope, params]`.

## 2. Findings

- Pinia stores directory: `app/stores` is configured via `pinia.storesDirs: []` in `nuxt.config.ts` (empty list — Pinia uses default discovery).
- The query-key convention must be verified by sampling queries per feature.
- A few API responses may be cached in Pinia when they should be in TanStack Query. Deferred to file-level audit.

## 3. Required Follow-Ups (deferred to PHASE 1)

1. Adopt the single query-key convention `[resource, scope, params]`.
2. Move any cached API response out of Pinia into TanStack Query.
3. Keep Pinia for: current session, current tenant, theme, ephemeral UI state.