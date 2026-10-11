# ReduCera AI Audit — DeveloperDay 2026 (Phase 0–2)

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-09`
>
> Source-verified audit of what the repository does today, written before any feature work.

This set replaces the claim baseline of the 2026-10-05 audit. The earlier index is preserved unchanged as [`README.prior-2026-10-05.md`](./README.prior-2026-10-05.md); the other 36 files of that audit (`ai-*-audit.md`, `phase-*-verification-report.md`, `p*-closure-report.md`, `system-scorecard.md`, …) are untouched and are treated as **claims to be checked**, not as evidence.

---

## Scope

| Item | Value |
|---|---|
| Audited object | `HEAD cb0572f` (2026-10-09 03:24 +0700, "feat: add internal agent sessions, decision traces, and episodes controllers", 410 files, +75,610 / −3,282) of `/home/misbahul45/code/reducera` |
| Git state when the audit started | `HEAD 25f89a8` (2026-10-04) with 131 modified, 13 deleted and 115 untracked paths. The owner committed that tree as `cb0572f` during the audit |
| First tracked by `cb0572f` | `services/ai-api/v1/{tutor,domain,memory,learner_model,episodes,decision_traces,evaluation,optimization,gamification,research}/`, `config/{llm_registry,model_router,agent_session,...}.py`, `errors/`, `middleware/`, and the 37 files of `docs/01-audit/` |
| Consistency check | After the commit, the import-graph and call-signature measurements were re-run against the committed tree; every headline number and cited line is unchanged |
| Services | `services/api` (NestJS), `services/ai-api` (FastAPI + Celery), `apps/web` (Nuxt 4), `infra/`, `docker-compose.yml` |
| Audit date | 2026-10-09 |
| Code changes made | None to application code. `.env` (untracked) and `.env.example` were edited at the owner's request (see [Changes made during the audit](#changes-made-during-the-audit)) |

## Method

A feature is `IMPLEMENTED` only when all five hold: **source exists, is registered, is reachable from a production entry point, is tested by a test that executes production code, and respects the service boundary.** Order of authority: source > tests > runtime > documentation.

| Measurement | How it was taken |
|---|---|
| ai-api reachability | AST import graph from `main`, `config.celery` and the three worker modules, with implicit parent-package imports. Static upper bound: an import that is never called still counts as reachable. Call sites were then read for every package that looked reachable |
| API module reachability | `@Module` graph from `AppModule`, imports resolved by file path (an earlier class-name-keyed run produced false "unreachable" results because two files both export `QuizModule`; that result is discarded) |
| Model usage | `prisma.<model>.<op>` search over `services/api/src` excluding specs |
| Tests | `pytest` (ai-api), `jest --ci` (api, no `TEST_DATABASE_URL`), `vitest run` (web). Results in [system-audit.md](./system-audit.md#test-results) |
| Runtime | `docker compose ps`, container env presence checks, service logs (last 6 h), read-only Qdrant queries |

Not done: no request was sent to an LLM provider (a key validity probe was declined by the permission layer and not retried), no database was written, no browser session was driven, no integration suite that needs `TEST_DATABASE_URL` was run.

## Status vocabulary

| Status | Meaning here | STYLE-GUIDE §2.1 equivalent |
|---|---|---|
| `IMPLEMENTED` | source + registered + reachable + tested + boundary-correct | `implemented` |
| `PARTIAL` | works for part of the intended behavior | `partial` |
| `SCAFFOLDED` | structure exists, behavior is stubbed, simulated or in-memory only | `scaffolded` |
| `UNWIRED` | working code that no production entry point reaches | no equivalent |
| `MISSING` | no source | `planned` / `referenced` |
| `BROKEN` | reachable and fails when executed | no equivalent |
| `UNVERIFIED` | exists, but no test or run exercises the production path (tests mock it) | no equivalent |
| `DEPRECATED` | superseded, still present | `superseded` |

The vocabulary follows the owner's protocol; `STYLE-GUIDE.md` §2.1 has fewer labels. Frontmatter, required sections and citation format follow the style guide.

## Documents

| File | Subject | Headline |
|---|---|---|
| [system-audit.md](./system-audit.md) | Repo map, runtime, tests, cross-service flows, claim conflicts | Every flow that crosses ai-api → api is `BROKEN` |
| [api-audit.md](./api-audit.md) | NestJS modules, routes, models, grading, internal contract | Grading is server-authoritative; learner-event store is empty |
| [ai-audit.md](./ai-audit.md) | ai-api architecture, LLM routing, pipelines, tests | 26 of 126 modules unreachable; live tutor path is a linear DAG |
| [agent-audit.md](./agent-audit.md) | Agent runtime, tools, budgets | No agent loop exists; registry is unreachable |
| [personalization-audit.md](./personalization-audit.md) | Learner state, mastery, policy | Only `dominantStyle` reaches the prompt |
| [memory-audit.md](./memory-audit.md) | Memory layers and write policy | Typed memory unreachable; production memory calls raise `TypeError` |
| [rag-audit.md](./rag-audit.md) | Retrieval, metadata, grounding | The tutor retrieval filter matches 0 of 65 stored chunks |
| [domain-audit.md](./domain-audit.md) | Accounting domain, domain adapter | Two ontologies with zero shared ids; no adapter layer |
| [gamification-audit.md](./gamification-audit.md) | Rewards, streaks, ledger | No reward ledger; streak is farmable |
| [dynamic-theme-audit.md](./dynamic-theme-audit.md) | Theme data → CSS path | DB/API theme path is not connected to SSR |
| [dynamic-ui-audit.md](./dynamic-ui-audit.md) | 13 dynamic dimensions × 8 layers | 0 of 13 dimensions adapt per learner |
| [evaluation-audit.md](./evaluation-audit.md) | Evaluator, benchmark, calibration | In-memory, unreachable, no human labels |
| [self-improvement-audit.md](./self-improvement-audit.md) | Episode → promote/rollback loop | No link of the loop is reachable end to end; DSPy absent |
| [security-audit.md](./security-audit.md) | Boundaries, auth, secrets, injection | Credentials cross service ownership at runtime |
| [implementation-readiness.md](./implementation-readiness.md) | Phase 2 exit gate | 4 corrections `READY`, 5 capabilities `BLOCKED`, 6 of 9 stop conditions hold; open questions Q-01…Q-07 |

## Finding register

Stable IDs per [STYLE-GUIDE §10](../STYLE-GUIDE.md). Detail and evidence are in the document named in the last column.

### Critical

| ID | Finding | Status | Detail |
|---|---|---|---|
| C-001 | ai-api calls api without a valid signature or token (`learning/service.py`, `users_steps/service.py`, `episodes/service.py`, `decision_traces/service.py`); the api guards reject them | `BROKEN` | [security-audit](./security-audit.md#c-001) |
| C-002 | Tutor RAG filter `metadata.source == "material"` returns 0 of 65 stored chunks; chunks carry no tenant, status or access fields | `BROKEN` | [rag-audit](./rag-audit.md#c-002) |
| C-003 | Five production call sites pass `user_id`/`lesson_id` to functions declared `userId`/`lessonId` → `TypeError`; tests mock the functions | `BROKEN` | [memory-audit](./memory-audit.md#c-003) |
| C-004 | `env_file: .env` injects every secret into every container: `api` holds `OPENAI_API_KEY`/`HF_TOKEN`; `ai-api`/`celery-worker` hold `DATABASE_URL` and JWT secrets; `web` holds all | `BROKEN` | [security-audit](./security-audit.md#c-004) |

### High

| ID | Finding | Status | Detail |
|---|---|---|---|
| H-001 | API → AI queue path is dead: `AI_URL` absent (fixed in `.env` 2026-10-09, containers not yet recreated), then no `Idempotency-Key` is sent (400), then failures return HTTP 200 and are stored as steps | `BROKEN` | [api-audit](./api-audit.md#h-001) |
| H-002 | BullMQ jobs carry the user's bearer token in Redis and forward it in header and body | `BROKEN` | [security-audit](./security-audit.md#h-002) |
| H-003 | Episode and decision-trace content is not measured: tokens/cost/latency `None`, constant `reason_codes`, hard-coded `tool_calls` | `BROKEN` | [self-improvement-audit](./self-improvement-audit.md#h-003) |
| H-004 | Live tutor prompt carries no learner state, strategy or memory; `TutorRuntime` is built and never called | `UNWIRED` | [personalization-audit](./personalization-audit.md#h-004) |
| H-005 | Two unrelated tutors: api `/tutor/message` (deterministic template) and ai-api `/learning/*` (LLM); no handoff | `PARTIAL` | [agent-audit](./agent-audit.md#h-005) |
| H-006 | Six learner-state tables have no reader or writer (`LearningEvent`, `LearningPreference`, `BehavioralSignals`, `SemanticLearnerMemory`, `ProceduralMemory`, `LearnerGoal`) | `SCAFFOLDED` | [api-audit](./api-audit.md#h-006) |
| H-007 | ai-api `evaluation`, `optimization`, `gamification`, `research` are unreachable and in-memory; api `EvaluationService`/`PromptOptimizationService` are unregistered; DSPy is absent | `UNWIRED` | [self-improvement-audit](./self-improvement-audit.md#h-007) |
| H-008 | No reward ledger; streak credited on chat-message POST; `Achievement` table unused | `MISSING` | [gamification-audit](./gamification-audit.md#h-008) |
| H-009 | Dynamic theming is not connected: `ThemeShell` gets no props, `getDefaultTheme` has no caller, no user layer | `UNWIRED` | [dynamic-theme-audit](./dynamic-theme-audit.md#h-009) |
| H-010 | LLM configuration split: duplicate keys in `.env` made the container use Flaz while local runs used Mistral. Fixed 2026-10-09; Mistral key validity `UNVERIFIED` | fix pending | [ai-audit](./ai-audit.md#h-010) |
| H-011 | ai-api rate limit is per-process and keyed by peer address; Redis client is created and never used; idempotency check does not deduplicate | `PARTIAL` | [security-audit](./security-audit.md#h-011) |
| H-012 | ai-api tenant id is `sha256(user_id)[:16]`, not the real tenant | `BROKEN` | [security-audit](./security-audit.md#h-012) |
| H-013 | 7 ai-api tests fail; they specify router adoption in the `users_steps` pipelines, which still call the LLM directly (3 of 8 LLM call sites use the router) | `BROKEN` | [ai-audit](./ai-audit.md#h-013) |

### Medium

| ID | Finding | Detail |
|---|---|---|
| M-001 | Mastery and misconception updates run after the grading transaction commits; a failure there is unrecoverable because a retry returns 409 | [api-audit](./api-audit.md#m-001) |
| M-002 | Misconception capture passes `correctAnswer: ''` and classifies only `wrong_answer`/`wrong_multiple_choice` | [api-audit](./api-audit.md#m-002) |
| M-003 | Personal policy is never persisted; `recordAttemptOutcome` has no caller | [personalization-audit](./personalization-audit.md#m-003) |
| M-004 | Duplicate implementations: 2 `MasteryService`, 2 `AdaptivePolicyService`, 2 misconception services in api, plus Python variants | [personalization-audit](./personalization-audit.md#m-004) |
| M-005 | Silent LLM-failure substitution and `user_step` `None` dereference in `prepare_learning_context` | [ai-audit](./ai-audit.md#m-005) |
| M-006 | `config/llm_output.py` JSON validators are unreachable | [ai-audit](./ai-audit.md#m-006) |
| M-007 | AI-generated text is written to memory unconditionally | [memory-audit](./memory-audit.md#m-007) |
| M-008 | `scripts/check-ownership-rules.sh` exits 1 on a third-party file in `.venv`; empty test collections reappeared in Qdrant | [system-audit](./system-audit.md#m-008) |
| M-009 | Web has no component, server-util or browser test for theme or AI UI | [dynamic-ui-audit](./dynamic-ui-audit.md#m-009) |
| M-010 | No trace id is set at nginx or by the BullMQ processors | [security-audit](./security-audit.md#m-010) |
| M-011 | 3 api modules and 1 controller are unreachable | [api-audit](./api-audit.md#m-011) |
| M-012 | `_signed_patch` is broken (empty signature, dict sent as form data) and unused | [security-audit](./security-audit.md#m-012) |
| M-013 | `POST /personalization/memory` takes an untyped payload and a client-chosen long-term `kind` | [memory-audit](./memory-audit.md#m-013) |
| M-014 | The PDF URL allow-list ignores its environment variables (keys absent from `ENVS`), so every PDF URL is blocked | [rag-audit](./rag-audit.md#m-014) |
| M-015 | Web search is silently off (empty key) and, when on, sends learner queries to a third party on every call | [rag-audit](./rag-audit.md#m-015) |

## Changes made during the audit

At the owner's request (2026-10-09) `.env` and `.env.example` were edited. No other file outside `docs/01-audit/` was changed.

| File | Change |
|---|---|
| `.env` | Removed the duplicate Flaz `OPENAI_API_KEY` and `OPENAI_BASE_URL`; kept one Mistral block; set `OPENAI_MODEL_FLASH=mistral-small-latest`, `OPENAI_MODEL_THINKING=magistral-medium-latest`; added `AI_URL=http://ai-api:3003/ai/v1` |
| `.env.example` | Same model and URL values; removed the second `OPENAI_BASE_URL` (line 113); added `AI_URL` |
| Effect | Running containers still hold the old values until recreated: `docker compose up -d --force-recreate api ai-api celery-worker` |

## Evidence citations

- Procedure and tooling: this file, section Method.
- Prior claim baseline: [`README.prior-2026-10-05.md`](./README.prior-2026-10-05.md), [`system-scorecard.md`](./system-scorecard.md), [`critical-findings.md`](./critical-findings.md).
- Documentation format: [`../STYLE-GUIDE.md`](../STYLE-GUIDE.md).

## Verdict

The repository contains substantial AI-layer code, first committed as `cb0572f` on the day of the audit. Of it, the model router, prompt-segmentation fences, the api grading path, the api deterministic tutor and the accounting sandbox are `IMPLEMENTED` or `PARTIAL`. The learner model, typed memory, adaptive policy, evaluation, optimization, gamification and research packages are `UNWIRED`, and the paths that do run in production (`/learning/generate-material`, `/learning/chat`, `/users-steps/generate`, episode and decision-trace writes) are `BROKEN` at the ai-api → api boundary. The platform is not yet a personalized, adaptive or self-improving system; it is a set of unit-tested components next to a production path that does not use them. Phase 3 design cannot start from the 2026-10-05 scorecard.
