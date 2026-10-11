# ADR-013: Signed service identity for api to ai-api calls

- Status: accepted by the owner on 2026-10-09 (the owner chose the H-002 design option and asked for its implementation)
- Date: 2026-10-09

## Context

`api` queues AI work in BullMQ and calls `ai-api` from the processors. The user's access token travels in the job (Redis, append-only file on disk, kept for failed jobs), in the `Authorization` header and in the JSON body, and it expires after 15 minutes while a retried job may wait longer (finding H-002). ADR-007 fixed the opposite direction with a signed service identity and an acting user.

## Decision

1. `api` calls `ai-api` as service `api`, signing each request with `INTERNAL_API_SECRET` over `(timestamp, method, target, sha256(body), actingUserId)`, the canonical string of ADR-007, and names the acting user in `x-acting-user-id`.
2. The secret differs from `INTERNAL_AI_API_SECRET`, so a signature is valid for one direction only. It is listed for `api` and `ai-api` only.
3. Job payloads carry identifiers, never credentials. `QueueService` validates payloads with strict schemas and rejects credential-like keys.
4. `ai-api` routes have one authentication mode each: `learning/chat`, `users-steps/generate-question` and `agents/run` keep the user's bearer token; `users-steps/generate`, `learning/generate-material`, `resources/extract` and `resources/embedding/{id}` accept only the service signature.
5. One client in `api` (`AiServiceClient`) talks to `ai-api` from jobs. It sends an idempotency key derived from the job id, treats an `{error}` body as a failure, and classifies failures as retryable or not.
6. nginx does not forward `/api/v1/internal/*`, blanks the `x-service-*` and `x-acting-user-id` headers on `/api/` and `/ai/`, and re-resolves upstream addresses.

## Consequences

- A leaked queue entry, log or Redis file holds no credential; a queued job no longer expires after 15 minutes.
- A learner token can no longer start the pipelines that only the queue needs.
- `api` can assert any acting user to `ai-api`; this adds no capability because `api` is the system of record, and every effect of `ai-api` on data returns through the signed routes of ADR-007.
- A new secret must be provisioned for every environment. Rotation without downtime is not part of this decision.
- Design: `docs/architecture/api-to-ai-api-service-identity.md`; tasks: `docs/plans/api-to-ai-api-service-identity-plan.md`.
