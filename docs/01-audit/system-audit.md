# System Audit — Repository, Runtime, Tests, Flows

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-09`
>
> What exists, what runs, what is tested, and which end-to-end flows work, measured at `HEAD cb0572f`.

---

## Scope

Whole repository: `services/api`, `services/ai-api`, `apps/web`, `infra/`, `docker-compose.yml`, `docker-compose.prod.yml` (not run), CI definition. Per-subsystem detail is in the other documents of this set; this file holds the repository map, the runtime snapshot, the test results, the cross-service flow table and the conflicts between documentation and source.

## Findings

### Repository map

| Area | Fact | Evidence |
|---|---|---|
| api modules | 97 `@Module` classes, 94 reachable from `AppModule`; 88 controllers, 87 registered; 334 HTTP handler decorators (regex count) | module graph resolved by file path; unreachable: `EventLogModule`, `SnapshotModule`, `DailyLogSseModule` |
| api data | 104 Prisma models, 56 enums, 17 migrations | `services/api/prisma/schema.prisma` (2424 lines), `services/api/prisma/migrations/` |
| api specs | 115 spec files, 18 of them `*.int.spec.ts` | `find services/api/src -name '*.spec.ts'` |
| ai-api code | 126 production modules, 15,373 lines; 60 test files | AST scan of `services/ai-api` excluding `.venv` |
| ai-api HTTP surface | `GET /`, `GET /ai/`, `/ai/v1/resources/*`, `/ai/v1/users-steps/*`, `/ai/v1/learning/*`, `/ai/v1/agents/run` | `services/ai-api/main.py:65-66`, `services/ai-api/v1/router.py:10-12` |
| ai-api Celery | 3 modules loaded: `v1.resources.workers`, `v1.users_steps.workers`, `v1.learning.workers` | `services/ai-api/config/celery.py:29-33` |
| web | 84 pages, 87 components, 8 layouts, 18 service modules, 13 test files | `apps/web/app/` |
| infra | `nginx`, `postgres`, `qdrant`, `grafana`, `prometheus`, `scripts` | `infra/` |
| compose | 9 services: `postgres`, `redis`, `qdrant`, `api`, `api-migrate`, `ai-api`, `web`, `celery-worker`, `nginx`; all load `.env` through `env_file` | `docker-compose.yml:10,40,66,91,156,192,256,293,337`; `env_file` at 14, 44, 70, … |

### Runtime snapshot (2026-10-09)

| Item | Observation | Evidence |
|---|---|---|
| Containers | 8 running, all `healthy` (`api-migrate` is a one-shot profile) | `docker compose ps` |
| Qdrant | `reducera-embedding` 65 points (all `source_kind=golden-graph`); `reducera-memory` 0 points; `test-collection` and `test-memory-collection` exist, 0 points | `GET /collections/*`, `POST /collections/reducera-embedding/points/count` |
| LLM gateway | `Error code: 401 - {'detail': 'Invalid API Key'}` in the local test run (2026-10-08 20:26 UTC). The running `ai-api` container held the Flaz configuration while local dotenv runs resolved the Mistral lines of the same `.env` (H-010). No LLM call was observed in container logs | pytest output; `printenv` in `ai-api` (values masked) |
| ai-api → api | `[SSE] upstream fetch failed: 401 Client Error: Unauthorized for url: http://api:3002…` at 2026-10-08 20:00:42, 20:10:06, 20:10:28 UTC | `docker compose logs ai-api` |
| Celery | `v1.user_steps.generate_personality_quiz` retried repeatedly with `3 validation errors for GenerateQuestionPipeline` | `docker compose logs celery-worker` |
| Tutor tasks | No `generate_content_material` or `generate_new_content` task ran in the last 6 h; their status below comes from code, not from a run | `docker compose logs celery-worker` |
| `AI_URL` | Not set in `api`, `ai-api` or `celery-worker`; the API's three BullMQ processors read it | `printenv` in `api`; `services/api/src/v1/queue/queues/*.processor.ts` |

### Test results

| Suite | Command | Result |
|---|---|---|
| ai-api | `.venv/bin/python -m pytest -q -p no:cacheprovider` | 486 passed, **7 failed**, 8.3 s |
| api | `npx jest --ci --silent` with `DATABASE_URL`, `TEST_DATABASE_URL` unset | 104 suites passed, 11 skipped; 1091 tests passed, 0 failed, 143 skipped, 38.4 s |
| web | `npx vitest run` | 13 files, 135 tests passed, 2.1 s |

ai-api tests by package: `config` 144, `v1/optimization` 62, `v1/memory` 39, `v1/learner_model` 38, `v1/learning` 30, `v1/evaluation` 29, `v1/research` 27, `v1/domain` 24, `__tests__` 24, `v1/gamification` 22, `v1/agents` 14, `v1/tutor` 11, `v1/users_steps` 8, `tests` 8, `utils/tools` 7, `v1/episodes` 3, `v1/decision_traces` 3. The four packages that no production path reaches (`optimization`, `evaluation`, `research`, `gamification`) hold 140 of the 490 collected tests.

The 11 skipped api suites need `TEST_DATABASE_URL`; the 18 integration specs were not run, so the payment, ledger, refund and payout invariants are `UNVERIFIED` in this audit (not failed).

### Cross-service flows

Each flow lists the first hop that fails. `HEAD` here means the code as committed.

| Flow | Path | Status | First failing hop |
|---|---|---|---|
| F1 Learning-path generation | web → api `POST` → BullMQ `user-steps` → ai-api `/users-steps/generate` → api reads | `BROKEN` | processor throws `AI_URL is not defined` (`user-steps.processor.ts:36-37`); with that fixed, ai-api answers 400 because the processor sends no `Idempotency-Key`; with that fixed, ai-api reads api with unsigned headers (C-001) |
| F2 Material generation | BullMQ → ai-api `/learning/generate-material` → Celery → LangGraph → api writes | `BROKEN` | `get_lesson` unsigned (`learning/service.py:191-209`); then `TypeError` at `content_pipeline.py:177` (C-003) |
| F3 Chat continuation | ai-api `/learning/chat` → Celery `generating_new_content` | `BROKEN` | `update_message_chat` unsigned (`learning/service.py:122-142`); RAG returns nothing even if it ran (C-002) |
| F4 Resource ingestion | api upload → BullMQ `knowledge` → ai-api `/resources/extract` → Qdrant → api callback | `BROKEN` | `AI_URL` unset (`knowledge.processor.ts:18-19`); the `TEXT` branch ignores the response status (`:30-37`). The ai-api → api leg is signed (`resources/service.py:22,43`) and is the only leg that is correctly authenticated |
| F5 Episode / decision-trace write | ai-api Celery → api `/internal/episodes`, `/internal/decision-traces` | `BROKEN` | request carries `x-service-id` only; guard requires timestamp and signature (`internal-service.guard.ts:56-63`) |
| F6 Deterministic tutor | web → api `POST /tutor/message` | `PARTIAL` | works as code (no LLM, template reply, real Episode and DecisionTrace rows); not run in this audit; reachability from the UI `UNVERIFIED` (one `'/tutor'` string in `apps/web/app`, not traced to a component) |
| F7 Quiz grading | api `QuizAttemptsController` → `submitAttempt` → mastery | `PARTIAL` | server-side and registered; no web caller found for `quiz-attempts`; integration suites skipped |
| F8 Accounting sandbox / simulator | web → api `/sandbox/*`, `/simulator/*` | `IMPLEMENTED` (api-only, deterministic) | web calls exist for both; specs pass (`engine-property`, `scenario-answer-key`, `simulator-property`) |
| F9 Theme to page | api `Theme` → web SSR → CSS | `UNWIRED` | `getDefaultTheme` has no caller (`apps/web/server/utils/theme.ts:76`) |
| F10 Streak | api interceptor → streak tables | `PARTIAL` | credited on any successful chat-message POST (H-008) |

### Prior claims against source

| Claim | Where | Source says | Verdict |
|---|---|---|---|
| "Cross-service writes to api … VERIFIED end-to-end via signed HMAC" | `p1-3-closure-report.md`, `system-scorecard.md` §8 | The production writers send no signature (`episodes/service.py:35-41`, `decision_traces/service.py:40-46`). The earlier check used hand-signed requests | contradicted for production code |
| "RAG PASS … live retrieval returns semantically correct top-3 hits" | `system-scorecard.md` §1 | Retrieval with the filter the tutor passes returns 0 of 65 points | contradicted ([rag-audit](./rag-audit.md#c-002)) |
| "Personalized Tutor … server-side E2E PASS" | `system-scorecard.md` §2 | F2 and F3 fail at the first api call | contradicted |
| "231+ ai-api tests pass" | `system-scorecard.md` §1 | 486 pass, 7 fail | outdated |
| "1214 api tests pass, 5 skipped" | `system-scorecard.md` §8 | 1091 pass, 143 skipped without a test database | not reproducible without `TEST_DATABASE_URL` |
| "Open violations: none" | `AGENTS.md` "Migration of existing violations" | Static source is clean; the runtime environment is not (C-004) | contradicted at runtime |
| `GamificationLedger` is append-only | `AGENTS.md` "Database" | No model, table or trigger of that name; triggers cover `LedgerTransaction`, `AICreditLedgerEntry`, `AuditLog`, `PaymentTransaction`, `DomainEvent` (`migrations/20260930040500_domain_foundation/migration.sql:659-661`, `20260930090100_payment_domain/migration.sql:132-133`) | contradicted |
| "Test collections removed" (P2-4) | `critical-findings.md` | `test-collection` and `test-memory-collection` exist again | not durable; cause not attributed (the ai-api suite was run during this audit) |
| `docs/01-audit` renamed to `docs/audit` | `CLAUDE.md` | Both exist: `docs/audit/` 26 tracked files, `docs/01-audit/` 37 files | contradicted; `STYLE-GUIDE.md` §3.1 names `docs/01-audit` |
| ai-api features are `learning`, `resources`, `users_steps` | `CLAUDE.md` "AI layout" | 15 packages under `v1/` | outdated |
| `docker-compose.build.yml` exists | `AGENTS.md` "Deployment Workflow" | file absent (already noted in `CLAUDE.md`) | contradicted |

### M-008

**Tooling noise.** `scripts/check-ownership-rules.sh` exits 1 with `VIOLATION [ai-api references DATABASE_URL]` for `services/ai-api/.venv/lib/python3.11/site-packages/langchain_community/document_loaders/notiondb.py:10`, a third-party file. Source under `services/ai-api` outside `.venv` contains no `DATABASE_URL` and no Prisma reference. The script does not exclude `.venv`; CI is unaffected because it runs on a clean checkout. The same script cannot see the runtime violation in C-004.

## Evidence citations

- `services/ai-api/main.py:26-66`, `services/ai-api/v1/router.py:10-12`, `services/ai-api/config/celery.py:29-33`
- `services/api/src/v1/v1.module.ts:36-72`, `services/api/prisma/schema.prisma`
- `docker-compose.yml:10-337`, `.env` (key names only), `docker compose ps`, `docker compose logs --since 6h`
- Test commands in the table above, run 2026-10-09
- Prior claims: `docs/01-audit/system-scorecard.md`, `docs/01-audit/critical-findings.md`, `AGENTS.md`, `CLAUDE.md`

## Verdict

The stack is up and healthy at the container level, and unit suites are green apart from 7 ai-api tests. None of the three LLM flows (F1–F3) and neither write-back flow (F4, F5) works, because the ai-api → api boundary is unauthenticated or misconfigured. The flows that work are api-only and deterministic (F6–F8). The 2026-10-05 scorecard's "server-side E2E PASS" rows are not supported by the code.
