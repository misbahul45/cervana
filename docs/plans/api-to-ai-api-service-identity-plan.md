# api to ai-api Service Identity — Implementation Plan

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-09`
>
> Ordered tasks that remove user tokens from the queue path and sign every `api` to `ai-api` call.

Design: [api-to-ai-api-service-identity.md](../architecture/api-to-ai-api-service-identity.md). Decision: [ADR-013](../decisions/ADR-013-api-to-ai-api-service-identity.md). Closes audit finding H-002 and the queue part of H-001.

---

## Objective

After this plan no job in Redis holds a credential, every call from a processor to `ai-api` is signed and idempotent, the four queue-only routes of `ai-api` accept nothing but the service signature, and nginx does not expose the internal contract.

## Scope

| Service | Created | Edited |
|---|---|---|
| `services/ai-api` | `config/service_identity.py`, tests | `v1/users_steps/router.py`, `v1/learning/router.py`, `v1/resources/router.py` and their tests |
| `services/api` | `src/common/ai-client/*` (client, module, error), `src/v1/queue/queue-payloads.ts`, `src/v1/queue/legacy-job-scrubber.ts`, specs | `queue.service.ts`, `queue.config.ts`, `queue.module.ts`, the three processors, `resources.{controller,service,repo}.ts`, `personality-quizzes.{controller,service}.ts` |
| repo | none | `.env.example`, `.env` (local, untracked), `docker-compose.yml`, `docker-compose.prod.yml`, `scripts/check-compose-env.py`, `infra/nginx/nginx.conf`, `AGENTS.md`, tracker |

Rules for every task: no comments in code or configuration; never `git add`, `commit` or `push`; recreate compose services with `--no-deps`; verify with the stated commands.

Baselines before this plan (2026-10-09): `services/api` `pnpm jest --ci --silent` 110 suites passed, 1162 tests passed, 143 skipped; `services/ai-api` `uv run pytest` 566 passed; `scripts/check-ownership-rules.sh` PASS.

## Step-by-step

| ID | Task | Verify |
|---|---|---|
| IMPL-QI-01 | `ai-api/config/service_identity.py`: `verify_service_request`, `service_actor` dependency (checks of the design, replay cache in Redis, same 401 for every failure, 400 without acting user). Spec first: shared vectors, stale and future timestamps, wrong caller id, wrong secret, tampered body or target or acting user, missing acting user, replay, unreachable Redis, missing secret | `uv run pytest -q config/__tests__/test_service_identity.py` |
| IMPL-QI-02 | Switch the four service routes to `service_actor`; keep `authenticated_user` on the user routes. Tests: signature accepted, bearer rejected (401) on service routes; service headers ignored and bearer still required on `learning/chat` | `uv run pytest -q __tests__ v1/learning v1/users_steps v1/resources`; whole suite stays green |
| IMPL-QI-03 | `api/src/common/ai-client`: `AiServiceClient`, `AiServiceError`, module exporting the client; reads `AI_URL` and `INTERNAL_API_SECRET`. Spec: the request it sends verifies with the Python vectors, signs the exact body bytes and the `pathname + search` target, carries both idempotency headers, maps statuses (retryable or not), detects an `{error}` body, honors the timeout | `pnpm jest src/common/ai-client` |
| IMPL-QI-04 | Payload schemas and `QueueService` validation; producers stop passing the token (`ResourcesController`, `ResourcesService`, `ResourcesRepo`, `PersonalityQuizzesController`, `PersonalityQuizzesService`). Specs: a token key is rejected, `userId` comes from `req.user`, job options carry `removeOnFail` | `pnpm jest src/v1/queue src/v1/material src/v1/learning/personality-quizzes`; `tsc --noEmit` |
| IMPL-QI-05 | Rewrite `UserStepsProcessor` and `KnowledgeProcessor` on the client; `ContentProcessor` is left as it is (its job has no acting user and `ai-api` has no route for it, C-002). Specs per processor: no `Authorization` header and no `token` in the body, signed request, idempotency key identical across two attempts of one job, `{error}` body fails the job, a 4xx is unrecoverable, a 503 is retried, partial step failure is reported and total failure throws | `pnpm jest src/v1/queue` |
| IMPL-QI-06 | `LegacyJobScrubber` (startup, all retained states, idempotent) and `removeOnFail` in `queue.config.ts`. Spec on a fake queue | `pnpm jest src/v1/queue` |
| IMPL-QI-07 | `INTERNAL_API_SECRET`: `.env.example` placeholder, a generated value in the local `.env`, `api` and `ai-api` environment lists in both compose files (not the shared anchor); `check-compose-env.py` forbids it in `celery-worker`, `web` and the anchor, with tests | `python3 scripts/check-compose-env.py`; `uv run pytest -q __tests__/test_compose_env_gate.py`; `docker compose config -q` for both files |
| IMPL-QI-08 | nginx: deny `/api/v1/internal/`, blank the service headers on `/api/` and `/ai/`, resolver, zone and `resolve` on the upstreams | `docker compose exec nginx nginx -t`; after reload: internal route through nginx 404, `/ai/` and `/api/` still 200, a recreated upstream is found without a reload |
| IMPL-QI-09 | Docs: `AGENTS.md` (cross-service rule 2, internal contract, open violations), tracker rows | `grep -n "H-002" AGENTS.md` shows only the resolved entry |
| IMPL-QI-10 | Deploy: build `api` and `ai-api`, `up -d --no-deps --wait`, reload nginx, run the startup scrub, `redis-cli BGREWRITEAOF`. Live checks: signed call to a service route passes authentication, unsigned 401, bearer 401, replay 401, user routes still accept bearer, no key of Redis job hashes holds a token | the checks of the list, logs without errors |

## Acceptance criteria

1. `grep -rn "token" services/api/src/v1/queue` finds no job field or header named token, and the three producers have no token parameter.
2. No Redis job hash (`bull:*`) contains a `token` field after the first start of the new `api`.
3. A call from a processor reaches `ai-api` with a valid signature and an `Idempotency-Key`; the same job attempt sent twice runs the pipeline once.
4. A learner bearer token on `users-steps/generate`, `learning/generate-material`, `resources/extract` and `resources/embedding/{id}` is 401.
5. `GET /api/v1/internal/...` through nginx is 404, and the `x-service-*` headers do not reach `ai-api` from outside.
6. `api` and `ai-api` suites pass, `scripts/check-ownership-rules.sh` passes, and the live stack is healthy with clean logs.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| clock skew between containers makes queued calls 401 | Medium | same Docker host; the failure is visible in BullMQ and logged with a reason code |
| the new secret is missing on one side after a deploy | High | the compose gate lists it for both services; the service routes fail closed with 401, the browser routes are unaffected |
| nginx `resolve` is not accepted by the installed build | Low | `nginx -t` runs before any reload; fall back to the reload step in the deploy procedure |
| removing the token changes the queue path while it is still broken (H-001) | Medium | the path does not work today; the client and tests make it work and observable |
| jobs of the old shape are still waiting | Low | the processors ignore the key; the scrubber removes it |

## Rollback

- Images before this change: `reducera-api:pre-qi-20261009` and `reducera-ai-api:pre-qi-20261009` (tagged before the build); retag as `latest` and `docker compose up -d --no-deps api ai-api`.
- nginx: restore `infra/nginx/nginx.conf` from version control and reload.
- The new secret can stay in the environment without effect.

## Progress

| Task | Status | Evidence |
|---|---|---|
| IMPL-QI-01 | [x] | `config/service_identity.py`; `test_service_identity.py` (23 tests); three mutants killed (acting user not verified, replay cache off, clock window ignored) |
| IMPL-QI-02 | [x] | four routes on `service_actor`; `test_service_routes_authentication.py` (24 tests); ai-api `pytest` 615 passed |
| IMPL-QI-03 | [x] | `common/ai-client/*`; 22 tests; the signatures equal the two vectors computed by the Python implementation |
| IMPL-QI-04 | [x] | `queue-payloads.ts` (strict schemas, `credentialFree`), `QueueService`, three producers without a token, `removeOnFail` 7 days / 500; 17 tests |
| IMPL-QI-05 | [x] | `UserStepsProcessor` (the AI call is retried on its own, the row creation is not repeated) and `KnowledgeProcessor`; 23 tests |
| IMPL-QI-06 | [x] | `LegacyJobScrubber` (6 tests); no retained job held a credential at the first start, so it logged nothing; `BGREWRITEAOF` status ok |
| IMPL-QI-07 | [x] | `INTERNAL_API_SECRET` (64 characters, different from the other direction) in `.env`, `.env.example`, both compose files for `api` and `ai-api`; gate forbids it in `celery-worker`, `web` and the shared anchor (11 gate tests) |
| IMPL-QI-08 | [x] | `nginx -t` ok; `/api/v1/internal/*` 404 from outside; a recreated `api` and `ai-api` were found without a reload (IPs changed, 0 connection failures) |
| IMPL-QI-09 | [x] | `AGENTS.md` (rule 2, internal contract, network, open violations, resolved entry), ADR-013, tracker |
| IMPL-QI-10 | [x] | images rebuilt, services recreated with `--no-deps`; live matrix: signed with acting user passes authentication (422 on a deliberately invalid query), other secret 401, valid signature through nginx 401 (headers stripped), replay 401, anonymous 401, learner bearer 401, swapped acting user 401; chain check api to ai-api to api with trace id `chain-check-1`; `containers hold`: `api` and `ai-api` the new secret, `celery-worker` and `web` none |

Verification: `services/api` `pnpm jest --ci --silent` 117 suites passed, 1230 tests passed, 143 skipped, 0 failed (baseline 1162); `services/ai-api` `uv run pytest` 615 passed (baseline 566); `scripts/check-ownership-rules.sh` PASS.

Not exercised: a real job through BullMQ that reaches the LLM. The development database holds no `LearningStyleProfile`, so `users-steps/generate` stops at the learning style lookup (the chain check above); the processors are covered by their specs.
