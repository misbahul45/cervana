# ADR-001: Multi-tenancy model

- Status: accepted for implementation (Phase 1)
- Date: 2026-09-30

## Context

ReduCera becomes a marketplace where teachers publish articles and classes. Creator data must be isolated per tenant, while learners consume across tenants. The existing code has one global `Role` on `User` and no tenant concept.

## Decision

1. **Global role stays on `User`** (`STUDENT`, `TEACHER`, `ADMIN`). The product term "USER" maps to `STUDENT`; no enum rename.
2. **`Tenant`, `TenantMembership`, `TenantSettings`** are new. A user may hold zero, one, or many memberships. Membership roles: `OWNER`, `MANAGER`, `TEACHER`, `EDITOR`. Tenant status: `ACTIVE`, `SUSPENDED`, `ARCHIVED`.
3. **Tenant context is derived, never trusted.** `TenantContextService` resolves it from the authenticated user plus an active membership in an active tenant. The `x-tenant-id` header only selects among the caller's own memberships; naming any other tenant yields `403 TENANT_ACCESS_DENIED`. A caller with several memberships must name one (`400 TENANT_REQUIRED`).
4. **`ADMIN` is global.** An admin may name any existing tenant. A tenant `OWNER` is not a platform admin.
5. **Provisioning.** Approving a teacher application creates a tenant and an `OWNER` membership in the same transaction, once per owner (repeat-safe).
6. **Defence in depth** (Phase 1 covers layers 1, 2, 3 helper and 5): `TenantContext` → `TenantGuard` with per-route membership roles → `tenantWhere(context)` helper for repositories → database constraints (unique `(tenantId, slug)`, foreign keys with `RESTRICT`) → tests. Row-level security is deferred until tenant-owned tables have real traffic.

## Consequences

- Every future tenant-owned repository must accept a `TenantContext` and filter with `tenantWhere`.
- Suspending a tenant takes effect on the next request because membership is checked per request.
- Curriculum (`Topic`, `Lesson`, ...) remains platform-global for now; teachers can still write it. Moving it under tenants is a separate decision.
