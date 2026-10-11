# ADR-007: AI/API service boundary and service authentication

- Status: accepted by the owner on 2026-10-09 (Q-03 of `docs/01-audit/implementation-readiness.md`) and adopted for the `ai-api` to `api` direction the same day. Design: `docs/architecture/ai-api-service-identity.md`; tasks: `docs/plans/ai-api-service-identity-plan.md`. `AGENTS.md` was amended on 2026-10-09 with the owner's approval (cross-service rules 1 and 5, internal contract).
- Date: 2026-09-30

## Context

`AGENTS.md` says `ai-api` must forward the original user's bearer token when calling `api`. In practice this made the user token the trust mechanism for machine-to-machine work: it was passed into Celery task arguments (stored in Redis), printed to logs, and `ai-api` never validated it. The target architecture asks for an internal service identity that carries user, tenant, trace and idempotency context.

## Decision

1. **Ownership is unchanged.** `api` owns PostgreSQL, authorization and financial state; `ai-api` owns LLM, embeddings, Qdrant and agent runtime; `ai-api` never receives `DATABASE_URL`.
2. **Internal requests are signed.** Headers: `x-service-id`, `x-service-timestamp` (ms), `x-service-signature` = hex `HMAC-SHA256(secret, timestamp \n METHOD \n path+query \n sha256(rawBody) \n actingUserId)` (the acting user is the empty string when absent; amendment A1 of 2026-10-09), plus `x-trace-id`, `x-idempotency-key` (mandatory for non-GET) and optional `x-acting-user-id`. The API rejects requests outside a 60 s clock window, replays within 120 s, unknown services and bad signatures, and fails closed when the secret is not configured. Comparison is constant time.
3. **Secrets** are per service (`INTERNAL_AI_API_SECRET`), supplied through the root `.env`.
4. **Internal routes** live under `/internal/...`, are marked `@InternalOnly()` and are not reachable with a user session, whatever its role.
5. **User-facing AI endpoints** authenticate the caller by asking `api` (`GET /auth/profile`) and checking the role. The AI service does not decode or trust tokens itself, and user tokens are no longer queued or logged.
6. The signature helpers exist in both languages with shared test vectors (`internal-signature.spec.ts`, `test_service_auth.py`).

## Status of adoption

Migrated (2026-10-09): resource read and callback, lessons, steps, user steps, learning styles, personality quizzes, content similarity, content and chat-message writes, episodes and decision traces. Not migrated: the agent tools and the decision-trace write of `ai-api/v1/agents/`, which still send the user's token to user-facing routes, and the `api` to `ai-api` direction (H-002).

## Replacement applied to `AGENTS.md`, cross-service rule 5 (2026-10-09)

> 5. Service-to-service calls authenticate with a signed service identity (`x-service-id` + HMAC signature) and carry the acting user, tenant, trace id and idempotency key as headers. `api` re-authorizes the acting user for every operation. User bearer tokens are not forwarded to internal routes.

## Consequences

- A leaked user token no longer grants access to internal routes, and internal secrets never reach browsers.
- The replay cache is in Redis (`internal:replay:*`), so it is shared by API replicas; when Redis is unreachable the guard logs a warning and lets the request through, and the signature, the clock window and the idempotency key still apply.
