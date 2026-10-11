# ai-api Service Identity — Implementation Plan

> **Status**: `planned` · **Owner**: `architect` · **Last reviewed**: `2026-10-09`
>
> Ordered tasks that move every `ai-api` → `api` call onto a signed service identity with a re-authorized acting user.

Design: [ai-api-service-identity.md](../architecture/ai-api-service-identity.md). Decision: ADR-007, accepted 2026-10-09. Closes audit finding C-001 and row 1d of [implementation-readiness.md](../01-audit/implementation-readiness.md).

---

## Objective

After this plan, no `ai-api` code sends a user bearer token or an unsigned header set to `api`, and each call in the design's inventory is accepted only when it carries a valid HMAC signature and names an acting user who owns the resource.

## Scope

| Service | Files created | Files edited | Files deleted |
|---|---|---|---|
| `services/api` | `src/v1/common/guards/ownership.policy.ts`, `src/common/authz/acting-user.guard.ts`, `src/common/authz/internal-acting.decorator.ts`, `src/v1/internal/internal-curriculum.controller.ts`, `src/v1/internal/internal-learner-reads.controller.ts`, `src/v1/internal/internal-learner-writes.controller.ts`, one spec per file | `src/v1/common/guards/ownership.guard.ts`, `src/v1/internal/internal.module.ts`, `src/common/authz/authz.module.ts`, `docs/architecture/AUTHORIZATION_MATRIX.md` | none |
| `services/ai-api` | `config/internal_client.py`, `config/__tests__/test_internal_client.py` | `v1/users_steps/service.py`, `v1/learning/service.py`, `v1/episodes/service.py`, `v1/decision_traces/service.py`, `v1/resources/service.py`, their tests | dead helpers `_signed_get`, `_signed_post`, `_signed_patch`, `get_content` |
| repo | none | `scripts/check-ownership-rules.sh` | none |

Out of scope: see the table in the design's Purpose section (`api` → `ai-api` direction, tenant id, agent runtime tools, environment allow-lists).

## Design

Summary of [the design](../architecture/ai-api-service-identity.md): keep `InternalServiceGuard` as is; add `ActingUserGuard` that loads the acting user and applies the ownership decision without the `ADMIN` bypass; expose one internal route per read or write the AI service needs; route all Python calls through one signing client.

Rules for every task:

- No comments in code, configuration or Dockerfiles (`AGENTS.md`, "Code Rules").
- Run only the stated verify commands; compare counts with the baselines below.
- Never run `git add`, `git commit` or `git push`; report changed files at the end.
- Tests that touch a database use `TEST_DATABASE_URL` on a scratch database, never the dev one.

Baselines taken on 2026-10-09 before this plan: `services/ai-api` `uv run pytest -q -p no:cacheprovider` → 516 passed, 7 failed (all in `v1/users_steps/__tests__/test_pipelines_routing.py`, finding H-013); `services/api` `pnpm jest --ci --silent` → 105 suites passed, 11 skipped, 1099 tests passed, 143 skipped, 0 failed.

## Step-by-step

### Owner-confirm items (answer before the task that needs them)

| ID | Question | Needed by | Default |
|---|---|---|---|
| A1 | Sign `x-acting-user-id` in the canonical string | IMPL-SI-00 | approved 2026-10-09 |
| A2 | Amend `AGENTS.md` cross-service rules 1 and 5, the replay-cache line and "Open violations" | IMPL-SI-12 | approved 2026-10-09 |

### Tasks

| ID | Task | Files | Verify |
|---|---|---|---|
| IMPL-SI-01 | Extract `assertOwnership(decision)` from `OwnershipGuard.canActivate`; add `allowAdminBypass`; guard calls it with `true`. No behavior change for user-facing routes | `ownership.policy.ts` (new), `ownership.guard.ts`, `__tests__/ownership.policy.spec.ts` (cases: owner allowed, other user 403, unknown resource 403 "Resource not found", unowned read allowed only with `allowUnownedRead`, ADMIN allowed with bypass and 403 without) | `cd services/api && pnpm jest src/v1/common/guards` all pass; `pnpm exec tsc --noEmit` clean |
| IMPL-SI-02 | `ActingUserGuard`, `InternalActing()` and `InternalOwnership()`. Guard: 400 `ACTING_USER_REQUIRED` without header, 403 for unknown or `isActive = false` user, sets `req.user`, reads `internal-ownership:resource` metadata and calls `assertOwnership` with `allowAdminBypass: false`. Register in `AuthzModule` | `acting-user.guard.ts`, `internal-acting.decorator.ts`, `authz.module.ts`, `__tests__/acting-user.guard.spec.ts` (cases above plus: guard order, service guard runs first, so an unsigned request is 401 before any user lookup) | `pnpm jest src/common/authz` all pass, including `route-access.spec.ts` |
| IMPL-SI-03 | Internal curriculum reads: `GET /internal/lessons/:id`, `GET /internal/steps`, `GET /internal/steps/:id`. `@InternalOnly()` only. Delegate to the services used by `lessons.controller.ts` and `steps.controller.ts`; same envelope | `internal-curriculum.controller.ts`, `internal.module.ts`, `__tests__/internal-curriculum.controller.spec.ts` (signed GET 200 with the expected `data`; unsigned 401; user JWT only 401) | `pnpm jest src/v1/internal` pass; `route-access.spec.ts` pass |
| IMPL-SI-04 | Internal learner reads: `GET /internal/user-steps/:id`, `GET /internal/learning-styles/:id`, `GET /internal/personality-quizzes`, `GET /internal/contents/similarity`. `@InternalActing()` plus `@InternalOwnership(...)` per the design table; `userId` query must equal the acting user | `internal-learner-reads.controller.ts`, spec | per route: owner 200, other user 403, missing acting header 400, unsigned 401 |
| IMPL-SI-05 | Internal learner writes: `PATCH /internal/chat-messages/:id`, `POST /internal/contents`, `POST /internal/personality-quizzes` (`POST /internal/chat-messages` dropped: `create_message_chat` has no caller). Zod `.strict()` DTOs reused from the user-facing routes; `@RequireIdempotencyKey()`; work inside `IdempotencyService.execute` | `internal-learner-writes.controller.ts`, spec | per route: owner 2xx, other user 403, same key and body twice writes one row and returns the same body, same key with another body 400 |
| IMPL-SI-06 | Authorization matrix: add the 10 new routes to `AUTHORIZATION_MATRIX.md` in the existing table format | `docs/architecture/AUTHORIZATION_MATRIX.md` | `pnpm jest src/common/authz/__tests__/route-access.spec.ts` pass; `bash scripts/check-ownership-rules.sh` reports no new hit |
| IMPL-SI-07 | Python client `InternalApiClient(session)` with `get`, `post`, `patch`; signs through `send_signed`; maps statuses per the design table; returns `data` | `config/internal_client.py`, `config/__tests__/test_internal_client.py` (a request prepared by the client verifies with `compute_signature` over the same target and body; 401 → `service_credentials_rejected`; ≥ 500 → `CrossServiceError`; non-GET carries both idempotency headers) | `cd services/ai-api && uv run pytest -q -p no:cacheprovider config/__tests__/test_internal_client.py config/__tests__/test_service_auth.py` pass |
| IMPL-SI-08 | Switch readers to the client: `get_steps`, `get_step`, `get_topic`, `get_learning_style`, `get_personality_quiz` in `users_steps/service.py`; `get_lesson`, `get_user_step`, `query_content_history` in `learning/service.py`. Keep function names and return shapes | `v1/users_steps/service.py`, `v1/learning/service.py`, tests that patch `requests` | `uv run pytest -q -p no:cacheprovider v1/users_steps v1/learning`: no new failure beyond the 7 H-013 tests |
| IMPL-SI-09 | Switch writers: `create_message_chat`, `update_message_chat`, `create_content_material`, `create_personality_quiz`, `write_episode`, `write_decision_trace`. Delete `_signed_get`, `_signed_post`, `_signed_patch` and `resources.get_content` | the four service files plus `v1/resources/service.py` | full ai-api suite: 516 passed or more, still 7 failed and the same 7 |
| IMPL-SI-10 | Detection gate: fail CI when a Python file under `services/ai-api` (outside `.venv`, tests, `config/internal_client.py`, `config/service_auth.py`) calls `requests` or `httpx` with a URL built from `NEST_API`, or sends an `Authorization` header to the api. Add a test that runs the script on a fixture | `scripts/check-ownership-rules.sh`, a fixture under `scripts/__tests__/` if the script already has tests, else a bash assertion in the task | `bash scripts/check-ownership-rules.sh` prints no violation from the new rule; the fixture run prints one |
| IMPL-SI-11 | Live check on the stack. Build and recreate: `docker compose build api ai-api celery-worker`, then `docker compose up -d --no-deps api ai-api celery-worker` (never `--force-recreate` without `--no-deps`, it recreates postgres, redis and qdrant). Smoke: signed `GET /internal/lessons/<id>` 200; the same request unsigned 401; the same request with a user JWT 401; signed `GET /internal/user-steps/<id>` with a non-owner acting user 403; one real `/learning/chat` call completes and writes a chat message row | none | `docker compose ps` all healthy; `curl http://localhost/nginx-health` 200; `curl http://localhost/api/v1/docs` 200; the four smoke calls return the stated codes; `docker compose logs --since 10m ai-api` shows no `service_credentials_rejected` |
| IMPL-SI-12 | After A2: edit `AGENTS.md` rule 1 (drop the forwarded-token example), rule 5 (replace with the ADR-007 text), the replay-cache line in "Internal contract with `ai-api`" (Redis, fails open), and "Open violations"; set ADR-007 status line to "accepted, adopted" and drop its stale replay-cache consequence | `AGENTS.md`, `docs/decisions/ADR-007-ai-api-service-boundary.md` | `grep -n "forward the original user" AGENTS.md` returns nothing |
| IMPL-SI-00 | After A1, last: add `actingUserId` to `canonicalString` and `canonical_string` (empty string when absent), update the shared vectors in `internal-signature.spec.ts` and `test_service_auth.py`, deploy `api` and `ai-api` together | `internal-signature.ts`, `service_auth.py`, both specs, `internal-service.guard.ts` (pass the header into the input) | both vector suites pass with the same expected hex; a request with a swapped `x-acting-user-id` is 401; the smoke calls of IMPL-SI-11 still pass |

Order: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12, then 00. Tasks 03 to 05 can run in parallel after 02. Task 07 can start after 02 and finish in parallel with 03 to 06, but 08 and 09 wait for 06.

## Acceptance criteria

1. `grep -rnE "requests\.(get|post|patch|put|delete)\(|httpx\." services/ai-api --include=*.py` outside `.venv`, tests, `config/internal_client.py` and `config/service_auth.py` shows no URL derived from `NEST_API`, apart from the out-of-scope `v1/agents/` calls listed in the design.
2. Each of the 10 internal routes has tests for: unsigned → 401, signed without acting user (learner routes) → 400, signed non-owner → 403, signed owner → 2xx.
3. `services/ai-api` suite: at least 516 passed and exactly the same 7 failures. `services/api` suite: at least 1099 passed, 0 failed, and `route-access.spec.ts` green.
4. `bash scripts/check-ownership-rules.sh` reports no violation other than the third-party `.venv` hit recorded as M-008.
5. On the live stack, one `/learning/chat` request produces a chat message row for the acting user and the `ai-api` log shows no 401 from `api`.
6. The mutation retry case holds: the same write sent twice with one `x-idempotency-key` creates one row.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `IdempotencyService.execute` is check-then-act: two concurrent requests with one key both run the work and the second fails with 500 | Medium | Celery retries are sequential; the same-key-twice tests cover replay after completion only; make the claim atomic in the shared service if concurrent duplicates appear |
| Clock skew above 60 s between containers makes every call 401 | Medium | same Docker host, same clock; the `service_credentials_rejected` reason makes the fault visible; check `docker compose exec api date` against `ai-api` if it appears |
| Query-parameter order or encoding differs between the signed target and the sent URL | Medium | the client builds the URL with `requests`' prepared request, which is what `send_signed` already signs; the test in IMPL-SI-07 verifies the signature over the prepared target |
| Replay cache fails open when Redis is unreachable (`internal-service.guard.ts:106-119`) | Low | the HMAC, the 60 s window and the idempotency key still apply; Redis outage also stops BullMQ and Celery |
| Flows that failed silently now run, so LLM cost and latency per request rise (M-005, H-001) | Medium | expected; measure with the episode fields once H-003 is fixed; `@rate_limit` and idempotency from RC-03 bound repeats |
| `ADMIN` users lose ownership reach through the AI service | Low | intended; admins use the admin routes directly |
| `rawBody` parser removed or `app.use(json())` added to `main.ts` makes every signed POST fail | High | `CLAUDE.md` forbids it; IMPL-SI-05 tests post a signed body through the real guard |
| Running `docker compose up --force-recreate` without `--no-deps` recreates postgres, redis and qdrant | Medium | task IMPL-SI-11 uses `--no-deps`; an interrupted run on 2026-10-09 left those containers in `Created` state until `docker compose up -d` restarted them (volumes were intact) |

## Rollback

- api additions are new routes and two new guards; leaving them in place while reverting `ai-api` changes the behavior of nothing, because no caller uses them.
- To revert `ai-api`, restore the previous `users_steps/service.py`, `learning/service.py`, `episodes/service.py`, `decision_traces/service.py` and `resources/service.py` from version control and rebuild `ai-api` and `celery-worker`. The calls return to the unsigned state described in the design, which is the state before this plan.
- The images of 2026-10-09 before this change are kept as `reducera-api:pre-si-20261009`, `reducera-ai-api:pre-si-20261009` and `reducera-celery-worker:pre-si-20261009`. To return the stack to them: `docker tag reducera-api:pre-si-20261009 reducera-api:latest` (and the same for the other two), then `docker compose up -d --no-deps api ai-api celery-worker`. Remove the tags with `docker rmi` once the change is accepted.
- IMPL-SI-00 reverts by restoring both canonicalization functions together and redeploying both services; a half-deployed A1 makes every signed call 401.
- `AGENTS.md` and ADR-007 edits (IMPL-SI-12) revert by restoring the files; no runtime effect.

## Progress

| Task | Status | Evidence (2026-10-09) |
|---|---|---|
| IMPL-SI-01 | [x] | `ownership.policy.ts`; guard and registry specs unchanged and green; `ownership.policy.spec.ts` |
| IMPL-SI-02 | [x] | `acting-user.guard.ts`, `internal-acting.decorator.ts`, `acting-scope.ts`; `acting-user.guard.spec.ts` (11 tests); `route-access.spec.ts` green |
| IMPL-SI-03 | [x] | `internal-curriculum.controller.ts`; spec 8 tests |
| IMPL-SI-04 | [x] | `internal-learner-reads.controller.ts`, `content-similarity.service.ts` (extracted; existing `contents.controller.spec.ts` unchanged except one added provider); spec 12 tests |
| IMPL-SI-05 | [x] | `internal-learner-writes.controller.ts`, `idempotent-write.interceptor.ts`, wider `citations` in `contents.dto.ts`; spec 15 tests; mutation checks: removing the interceptor fails 3 tests, enabling the `ADMIN` bypass fails 1 |
| IMPL-SI-06 | [x] | section "Internal routes for `ai-api`" in `AUTHORIZATION_MATRIX.md` |
| IMPL-SI-07 | [x] | `config/internal_client.py`; `test_internal_client.py` (14 tests): signature verifies over the prepared target and body, one idempotency key per distinct operation, typed errors per status |
| IMPL-SI-08 | [x] | `users_steps/service.py`, `learning/service.py` read through the client; `test_service_internal_calls.py` in both packages (8 and 6 tests); history text key fixed to `text` |
| IMPL-SI-09 | [x] | `create_content_material`, `update_message_chat`, `create_personality_quiz`, `write_episode`, `write_decision_trace` write through the client; `_signed_*`, `create_message_chat`, `resources.get_content` deleted; episode and decision-trace tests rewritten for the signed transport and checked against the api schema keys |
| IMPL-SI-10 | [x] | rule "ai-api calls api without the signing client" in `scripts/check-ownership-rules.sh`; `test_ownership_gate_signing_client.py` (3 tests on fake trees) |
| IMPL-SI-11 | [x] (partial) | images rebuilt and `api`, `ai-api`, `celery-worker` recreated with `--no-deps`; all 8 services healthy; 0 DI errors; 10 internal routes mapped; signed lesson read 200, unsigned 401, steps with filter and sort 200, acting-user guard 400 and 403 cases, replayed signature 401. Not run: a real `/learning/chat` request (needs a user token, writes rows and calls the LLM, whose key validity is `UNVERIFIED`, H-010) |
| IMPL-SI-12 | [x] | owner approved A2 on 2026-10-09; `AGENTS.md` rules 1 and 5, internal contract, "Open violations" and a "Resolved 2026-10-09" entry amended; ADR-007 status and consequences updated |
| IMPL-SI-00 | [x] | owner approved A1 on 2026-10-09; `canonicalString` and `canonical_string` sign the acting user; four shared vectors pass in both suites (`internal-signature.spec.ts`, `test_service_auth.py`); swapped or added `x-acting-user-id` is 401 (`acting-user.guard.spec.ts`); deployed with `api` and `ai-api` together and checked live: swapped header 401, header added to an unsigned-user request 401, signed with acting user 200 |

Verification after IMPL-SI-01 to 06 (api side): `services/api` `pnpm jest --ci --silent` 110 suites passed, 11 skipped, 1158 tests passed, 143 skipped, 0 failed (baseline 1099); `tsc --noEmit` clean. The Nest dependency graph of `InternalModule` is not proven by those specs (they build each controller with fake providers); the live stack proved it (IMPL-SI-11).

Verification after IMPL-SI-07 to 10 (ai-api side): `services/ai-api` `uv run pytest` 549 passed, 7 failed (the same 7 H-013 tests; baseline 516 passed, 7 failed).
