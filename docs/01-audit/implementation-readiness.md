# Implementation Readiness — Phase 2 Exit Gate

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-09`
>
> Which parts of the target can start, which cannot, and which owner decisions stand in the way.

---

## Scope

Every capability in the implementation order (foundation, domain abstraction, learner state, memory and RAG, adaptive policy, agent runtime, experience compiler, dynamic UI, gamification, evaluation, self-improvement), classified `READY`, `BLOCKED`, `REQUIRES-DESIGN`, `REQUIRES-API`, `REQUIRES-WEB`, `REQUIRES-DATA` or `REQUIRES-AI`. A capability can carry several `REQUIRES-*` labels. `READY` means no open finding, decision or missing dependency prevents starting it; it does not mean it is small.

## Findings

### Stop conditions (protocol §24)

| Condition | Holds now | Basis |
|---|---|---|
| Actual architecture unknown | no | this audit set |
| Database ownership unclear | no | api owns Postgres at source; runtime env contradicts it (C-004) |
| Agent permissions unclear | **yes** | no agent runtime, no budgets, registry cannot authorize (agent-audit) |
| Domain authority unclear | **yes** | two ontologies with zero shared ids and no designated owner (domain-audit) |
| Reward authority unclear | partly | api owns rewards; no rule, ledger or idempotency mechanism (H-008) |
| Learner state source unclear | **yes** | four mastery and three policy implementations, ids differ (H-004, M-004) |
| Evaluation ground truth missing | **yes** | no human labels, canned runner output (evaluation-audit) |
| Security boundary unclear | **yes** | source is clean, runtime environment is not; ai-api → api calls rejected (C-001, C-004) |
| Current implementation contradicts documentation | **yes** | claims table in [system-audit](./system-audit.md#prior-claims-against-source) |

Six conditions hold. Under the protocol, no feature implementation starts until the owner decisions below are taken and Phase 3 and Phase 4 documents exist. Items marked `READY` are corrections inside an already decided design and do not need a new architecture.

### Capability classification

| # | Capability | Class | Why | Reusable assets |
|---|---|---|---|---|
| 1a | Fix keyword mismatch in memory tool calls (C-003) and replace the mocks that hide it with a test that calls the real function | `READY` | defect is local; 5 call sites | existing tests as a base |
| 1b | Reject repeated step completion before granting points (H-008, vector 1) | `READY` | local change in `user-steps.repo.ts`; add a test | `P2002` pattern already used by badges |
| 1c | Put `AI_URL` in the containers; send `Idempotency-Key`; stop treating HTTP 200 `{"error"}` as steps (H-001) | `READY` for the first part (done in `.env`, needs container recreate); `REQUIRES-API` for the processors | processors are api code; also depends on the identity decision (row 1e) | `.env` fix |
| 1d | Sign every ai-api → api call (C-001) | `REQUIRES-API`, `REQUIRES-DESIGN` | the user-facing routes need a JWT; the signed path needs `/internal/*` routes for lessons, steps, topics, learning styles, chat messages and contents, which do not exist | `send_signed`, `InternalServiceGuard`, `/internal/resources` as the pattern |
| 1e | Service identity versus forwarded token (H-002, ADR-007) | `REQUIRES-DESIGN` | `AGENTS.md` prescribes token forwarding; ADR-007 proposes signed identity and is not accepted (Q-03 below) | `docs/decisions/ADR-007-ai-api-service-boundary.md` |
| 1f | Per-service environment instead of `env_file` for all (C-004) | `REQUIRES-DESIGN` | conflicts with the single-root-`.env` rule; needs the allow-list per service | compose structure |
| 1g | Measured episodes and traces: tokens, cost, latency, prompt/policy/model versions (H-003) | `REQUIRES-AI` | the router must return usage; workers must pass it; prompts need version ids | `ModelRouter` attempts, api episode schema already accepts the fields |
| 1h | Rate limit and idempotency that deduplicate (H-011) | `READY` | ai-api only; Redis is available | `RateLimiter`, api `IdempotencyService` as the model |
| 1i | Real tenant id in sessions (H-012) | `REQUIRES-API` | the api must return the caller's tenant in the resolve call | `InternalAgentSessionsController` |
| 1j | Trace id from the edge through the queue (M-010) | `REQUIRES-API` | nginx and processors must set and forward it | `TraceIdMiddleware` |
| 2 | Domain adapter layer and registry | `REQUIRES-DESIGN`, `REQUIRES-DATA` | needs the ontology owner (Q-02) and an id mapping or migration between 65 api topics and 13 Python ids | Python `ConceptGraph`, validators, `GoldenScenarioProvider` |
| 3 | `LearnerStateSnapshot` and event store | `BLOCKED`, `REQUIRES-API`, `REQUIRES-DESIGN` | blocked by row 2 (ids) and by the choice of canonical mastery model (Q-04); needs `LearningEvent` writer, preference and behavior stores | tables exist (`LearningEvent`, `LearningPreference`, `BehavioralSignals`); Python `LearnerState` and `MasteryService` |
| 4a | RAG: scoped, filtered retrieval with governance metadata (C-002) | `REQUIRES-DESIGN`, `REQUIRES-DATA`, `REQUIRES-AI` | metadata contract (tenant, status, access scope, version, domain, concept) and a re-index or payload update of the 65 chunks | embedding pipeline, collection guard, fences |
| 4b | Typed memory with write policy, decay, scoping | `BLOCKED`, `REQUIRES-DESIGN` | blocked by 1d (signed reads/writes) and by Postgres-versus-Qdrant source of truth | Python memory layers, api `EpisodicMemory` |
| 5 | Adaptive policy with typed reason codes | `REQUIRES-DESIGN` | three implementations to reconcile; needs row 3 for inputs | Python policy (typed reason codes), api strategy policy (invariants) |
| 6 | Bounded agent runtime, tool registry, budgets | `BLOCKED`, `REQUIRES-DESIGN`, `REQUIRES-AI` | blocked by 1d, 1g, 3, 4; registry lacks `resolve/authorize/execute`, schemas, scopes, `ADMIN` class | `ToolMetadata`, six domain tools |
| 7 | Experience profile, compiler, snapshot, natural-language proposals | `REQUIRES-DESIGN`, `REQUIRES-API`, `REQUIRES-WEB` | nothing exists; depends on row 3 for non-preference inputs | 14-token set, variant keys, theme lifecycle, deterministic palette generator |
| 8 | Dynamic UI (composables, SSR delivery, tokens beyond color) | `REQUIRES-WEB`, `REQUIRES-DESIGN` | needs row 7; accessibility layers (contrast, forced colors) and a browser test matrix | resolver, `ThemeShell`, `getDefaultTheme`, `density` shell |
| 9 | Gamification: rules, ledger, engine, missions | `REQUIRES-API`, `REQUIRES-DESIGN`, `REQUIRES-DATA` | new append-only table and trigger; rule catalog; achievement seed data; depends on row 3 | Python rule/boundary/narration design |
| 10 | Evaluation: adapter for the real tutor, independent judge, calibration | `BLOCKED`, `REQUIRES-AI`, `REQUIRES-DATA` | blocked by 1g; needs human-labeled data and a judge prompt | evaluator, 54-case benchmark, kappa routine |
| 11 | Self-improvement loop incl. DSPy | `BLOCKED` | blocked by 10 and a runtime prompt registry; `dspy` not a dependency | Python gate, canary, rollback, approval classes; api `PromptVersion` enum |
| 12 | Circular creator economy metrics | `REQUIRES-DESIGN` | not audited in depth; payment, earning and ledger code exist (`CreatorEarning`, `Wallet`, `LedgerTransaction`) and their integration suites were not run | api commerce modules |

### Open questions that gate design (owner decisions)

Each has a proposed default; none is applied. IDs follow `STYLE-GUIDE.md` §10 (`Q-`); the strategy register's own `D-01` is cited as `D-01`.

| ID | Decision | Proposed default | Blocks rows |
|---|---|---|---|
| Q-01 | Launch segment (`docs/strategy/decision-register.md` `D-01`): university-first, SMA-first, or both | A: university first | 2, 7 (copy, onboarding) |
| Q-02 | Owner of the domain ontology: api golden graph (65 topics) or Python domain (13 concepts with rules and misconceptions) | api owns ids and prerequisites; Python-style rules and misconceptions become api data; ai-api consumes through an adapter | 2, 3, 4, 5 |
| Q-03 | Accept ADR-007 (signed service identity replaces forwarded tokens) | accept; ai-api reads through `/internal/*` with the acting user id | 1d, 1e, 4b, 6 |
| Q-04 | Canonical mastery and policy implementation (two api, one Python each) | one api-owned mastery with event-sourced updates; one policy with typed reason codes; delete or fold the others | 3, 5 |
| Q-05 | Fate of committed but unreachable ai-api packages (`evaluation`, `optimization`, `gamification`, `research`; tutor runtime) | keep as design reference until Phase 3 assigns each a target; do not wire as is, because they are in-memory | 9–11 |
| Q-06 | Environment policy: single root `.env` with `env_file`, or per-service allow-lists | per-service `environment` allow-lists | 1f |
| Q-07 | LLM provider and models after the Flaz → Mistral change (models not benchmarked; Mistral key not validated here) | re-run `infra/scripts/llm-bench/` before fixing models | 1g, 6, 10 |

## Evidence citations

- Findings C-001…M-015 in [README.md](./README.md#finding-register) and the documents it links
- `docs/strategy/decision-register.md:23,51`; `docs/decisions/ADR-007-ai-api-service-boundary.md`
- `AGENTS.md` sections "Service Ownership & Cross-Service Boundaries" and "Migration of existing violations"

## Exit gate check

| Requirement | Met | Note |
|---|---|---|
| All critical AI paths audited | yes | tutor (material, chat), path generation, resource ingestion, episodes/traces, memory, RAG, evaluation, optimization, gamification, theme |
| All major modules classified | yes | ai-api by package with measured reachability; api by module reachability and model usage; web by theme/AI/composable paths |
| Conflicts documented | yes | [system-audit claims table](./system-audit.md#prior-claims-against-source) |
| Missing capabilities documented | yes | `MISSING` rows in every document |
| Source evidence attached | yes | file:line, counts, live probes |

Not audited or only partly audited, so statuses there are not claims of absence:

| Area | What was not done |
|---|---|
| Live LLM behavior | no request to a model provider; Mistral key validity unknown; no tutor task ran in the observed window |
| Database-backed behavior | 18 integration suites skipped; payments, ledger, refunds, payouts, tenants not re-audited |
| Browser behavior | no Playwright run; responsiveness, contrast and focus unverified |
| Files read by name and size only | `theme-validator.ts`, `theme-asset-policy.ts`, `v1/optimization/safety.py`, `v1/optimization/failure_mining.py` categories, `v1/research/runner.py` internals, `v1/memory/{semantic,isolation,layer}.py`, `v1/learner_model/{llm_signal,events,preferences}.py`, `v1/domain/validators/*` |
| Web flows | onboarding wizard, personality quiz UI, `Chatbot.vue` request path, `'/tutor'` caller |
| Infra | nginx rate zones and uvicorn forwarded-header settings; Grafana/Prometheus dashboards |

## Verdict

Phase 2 is complete as an audit: the repository is mapped, every claim carries evidence, and the conflicts with earlier documents are listed. Implementation is not ready to start as a whole. Six of the nine stop conditions hold, and five capabilities (learner state, typed memory, agent runtime, evaluation, self-improvement) are `BLOCKED` by findings that must be corrected first (C-001, C-002, C-003, H-003). Four corrections are `READY` today (1a, 1b, 1h and the `.env` part of 1c). Phase 3 can proceed on the strength of this audit once the owner takes Q-01 to Q-07 or accepts the proposed defaults.
