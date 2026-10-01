# Progress Tracker

> **Single source of truth for "what is the status of each task?"**
> Updated as planning and implementation progress.

**Legend**:
- `[ ]` not started · `[~]` in progress · `[x]` complete · `[!]` blocked
- Priority: `P0` (must before prod) · `P1` (self-improvement) · `P2` (research-grade) · `P3` (nice-to-have)

---

## Planning Phase (current phase)

### Documentation deliverables

| ID | Task | Priority | Status | Owner | Evidence |
|---|---|---|---|---|---|
| P-001 | `docs/README.md` (directory index) | P1 | [x] | planner | [README.md](./README.md) |
| P-002 | `docs/progress-tracker.md` (this file) | P1 | [x] | planner | [progress-tracker.md](./progress-tracker.md) |
| P-003 | `docs/01-audit/system-audit.md` | P1 | [x] | planner | [system-audit.md](./01-audit/system-audit.md) |
| P-004 | `docs/01-audit/agent-architecture-current.md` (with ASCII) | P1 | [x] | planner | [agent-architecture-current.md](./01-audit/agent-architecture-current.md) |
| P-005 | `docs/02-architecture/target-state.md` | P1 | [x] | planner | [target-state.md](./02-architecture/target-state.md) |
| P-006 | `docs/02-architecture/data-model.md` | P1 | [x] | planner | [data-model.md](./02-architecture/data-model.md) |
| P-007 | `docs/02-architecture/learner-state.md` | P1 | [x] | planner | [learner-state.md](./02-architecture/learner-state.md) |
| P-008 | `docs/03-plans/phased-roadmap.md` | P1 | [x] | planner | [phased-roadmap.md](./03-plans/phased-roadmap.md) |
| P-009 | `docs/03-plans/self-improving-llm.md` | P1 | [x] | planner | [self-improving-llm.md](./03-plans/self-improving-llm.md) |
| P-010 | `docs/03-plans/openai-migration.md` | P1 | [x] | planner | [openai-migration.md](./03-plans/openai-migration.md) |
| P-011 | `docs/03-plans/dspy-integration.md` | P1 | [x] | planner | [dspy-integration.md](./03-plans/dspy-integration.md) |
| P-012 | `docs/03-plans/service-boundaries.md` | P1 | [x] | planner | [service-boundaries.md](./03-plans/service-boundaries.md) |
| P-013 | `docs/04-operations/acceptance-criteria.md` | P1 | [x] | planner | [acceptance-criteria.md](./04-operations/acceptance-criteria.md) |
| P-014 | `docs/04-operations/failure-modes.md` | P1 | [x] | planner | [failure-modes.md](./04-operations/failure-modes.md) |
| P-015 | `docs/04-operations/safety-guards.md` | P1 | [x] | planner | [safety-guards.md](./04-operations/safety-guards.md) |
| P-016 | Add `AGENTS.md` Service Ownership section | P0 | [x] | planner | `AGENTS.md` lines 82-143 |
| P-017 | `docs/01-audit/api-inventory.md` (full endpoint table) | P1 | [x] | planner | [api-inventory.md](../docs/01-audit/api-inventory.md) |
| P-018 | `docs/01-audit/microservice-boundary-audit.md` (main new deliverable) | P1 | [x] | planner | [microservice-boundary-audit.md](../docs/01-audit/microservice-boundary-audit.md) |
| P-019 | `docs/01-audit/business-logic-location-audit.md` (rules in prompts) | P1 | [x] | planner | [business-logic-location-audit.md](../docs/01-audit/business-logic-location-audit.md) |
| P-020 | `docs/01-audit/tool-audit.md` (permissions, side effects) | P1 | [x] | planner | [tool-audit.md](../docs/01-audit/tool-audit.md) |
| P-021 | `docs/01-audit/security-audit.md` (prompt / memory / RAG injection) | P1 | [x] | planner | [security-audit.md](../docs/01-audit/security-audit.md) |
| P-022 | `docs/04-operations/test-matrix.md` (per-layer coverage) | P1 | [x] | planner | [test-matrix.md](../docs/04-operations/test-matrix.md) |
| P-023 | `docs/04-operations/concurrency-and-consistency.md` (race + consistency) | P1 | [x] | planner | [concurrency-and-consistency.md](../docs/04-operations/concurrency-and-consistency.md) |
| P-024 | `docs/standards/standards-matrix.md` (ISO/WCAG/OWASP alignment) | P1 | [x] | planner | [standards-matrix.md](../docs/standards/standards-matrix.md) |
| P-025 | `docs/architecture/service-responsibility-matrix.md` (API vs AI vs Worker) | P1 | [x] | planner | [service-responsibility-matrix.md](../docs/architecture/service-responsibility-matrix.md) |
| P-026 | `docs/architecture/circular-economy-model.md` (target loop + KPIs) | P1 | [x] | planner | [circular-economy-model.md](../docs/architecture/circular-economy-model.md) |
| P-027 | `docs/architecture/accounting-sandbox.md` (deterministic + isolated) | P1 | [x] | planner | [accounting-sandbox.md](../docs/architecture/accounting-sandbox.md) |
| P-028 | `docs/architecture/ai-agent-marketplace.md` (second product surface) | P1 | [x] | planner | [ai-agent-marketplace.md](../docs/architecture/ai-agent-marketplace.md) |
| P-029 | `docs/architecture/agent-safety.md` (tool allow-list + permissions + audit) | P1 | [x] | planner | [agent-safety.md](../docs/architecture/agent-safety.md) |

### Discovery completed

| ID | Task | Status | Evidence |
|---|---|---|---|
| D-001 | Repository discovery (services, modules, packages) | [x] | First audit report |
| D-002 | Read core configuration (docker-compose, .env, Dockerfile, AGENTS.md, READMEs) | [x] | First audit report |
| D-003 | Database schema audit (Prisma + migrations) | [x] | [system-audit.md §19](./01-audit/system-audit.md) |
| D-004 | API surface audit (NestJS + FastAPI endpoints) | [x] | [system-audit.md §3](./01-audit/system-audit.md) |
| D-005 | AI/LLM components audit (Gemini, embeddings, LangGraph) | [x] | [agent-architecture-current.md](./01-audit/agent-architecture-current.md) |
| D-006 | RAG pipeline audit (Qdrant, chunking, retrieval) | [x] | [system-audit.md §5](./01-audit/system-audit.md) |
| D-007 | Memory system audit | [x] | [system-audit.md §6](./01-audit/system-audit.md) |
| D-008 | Gamification audit | [x] | [system-audit.md §7](./01-audit/system-audit.md) |
| D-009 | Learner model audit | [x] | [system-audit.md §8](./01-audit/system-audit.md) |
| D-010 | Accounting domain audit | [x] | [system-audit.md §9](./01-audit/system-audit.md) |
| D-011 | Self-improvement mechanism audit (preliminary) | [x] | [self-improving-llm.md §3](./03-plans/self-improving-llm.md) |
| D-012 | Security audit | [x] | [system-audit.md §11](./01-audit/system-audit.md) |
| D-013 | Privacy audit | [x] | [system-audit.md §12](./01-audit/system-audit.md) |
| D-014 | Observability audit | [x] | [system-audit.md §13](./01-audit/system-audit.md) |
| D-015 | Testing audit | [x] | [system-audit.md §14](./01-audit/system-audit.md) |
| D-016 | Failure mode + cost analysis | [x] | [failure-modes.md](./04-operations/failure-modes.md) |
| D-017 | ASCII visualization of agentic system | [x] | [agent-architecture-current.md](./01-audit/agent-architecture-current.md) |
| D-018 | "Is it agentic yet?" honest answer | [x] | Conversation log (this audit) |
| D-019 | Identify CRITICAL/HIGH/MEDIUM/LOW architectural debt | [x] | [system-audit.md §16](./01-audit/system-audit.md) |
| D-020 | Build target architecture | [x] | [target-state.md](./02-architecture/target-state.md) |
| D-021 | Design learner state + mastery formula | [x] | [learner-state.md](./02-architecture/learner-state.md) |
| D-022 | Design data model additions | [x] | [data-model.md](./02-architecture/data-model.md) |
| D-023 | Design DSPy/GEPA integration | [x] | [dspy-integration.md](./03-plans/dspy-integration.md) |
| D-024 | Design 12-week self-improving LLM plan | [x] | [self-improving-llm.md](./03-plans/self-improving-llm.md) |
| D-025 | Design OpenAI langchain migration plan | [x] | [openai-migration.md](./03-plans/openai-migration.md) |
| D-026 | Service ownership rule added to AGENTS.md | [x] | [service-boundaries.md](./03-plans/service-boundaries.md) |
| D-027 | Definition of done written | [x] | [acceptance-criteria.md](./04-operations/acceptance-criteria.md) |
| D-028 | Safety guards designed | [x] | [safety-guards.md](./04-operations/safety-guards.md) |

---

## CRITICAL findings awaiting remediation (Phase 0 prerequisites)

These are CRITICAL issues discovered during audit. They MUST be fixed before Phase 1 starts.

| ID | Issue | Evidence | Phase | Status |
|---|---|---|---|---|
| C-001 | `/chat/contents/similarity` endpoint missing; ai-api call always fails | [system-audit.md §16 #1](./01-audit/system-audit.md) | Phase 0 | [ ] |
| C-002 | `contents.repo.ts` queries `content_embeddings` table but no such Prisma model | [system-audit.md §16 #2](./01-audit/system-audit.md) | Phase 0 | [ ] |
| C-003 | `addContentEmbeddingJob` enqueues to `content` queue but `content.processor.ts` missing | [system-audit.md §16 #3](./01-audit/system-audit.md) | Phase 0 | [ ] |
| C-004 | Quiz evaluation missing — `Answer.isCorrect`, `pointsEarned`, `QuizAttempt.score` never set | [system-audit.md §16 #4](./01-audit/system-audit.md) | Phase 1 | [ ] |
| C-005 | `tool_semantic_search` always falls back to cross-lesson memory | [system-audit.md §16 #5](./01-audit/system-audit.md) | Phase 2 | [ ] |
| C-006 | No tests; stale `app.e2e-spec.ts` asserts "Hello World!" | [system-audit.md §16 #6](./01-audit/system-audit.md) | Phase 1 + ongoing | [ ] |
| C-007 | No ownership checks on chat/user-step routes (UUID bypass risk) | [system-audit.md §16 #7](./01-audit/system-audit.md) | Phase 1 | [ ] |

---

## HIGH findings (before production)

| ID | Issue | Evidence | Phase | Status |
|---|---|---|---|---|
| H-001 | `ActivityDetectorInterceptor` mints streaks on any authenticated ping | [system-audit.md §16 #8](./01-audit/system-audit.md) | Phase 1 | [ ] |
| H-002 | RAG citations hard-coded to `[]` | [system-audit.md §16 #9](./01-audit/system-audit.md) | Phase 5 | [ ] |
| H-003 | Document URLs fetched from arbitrary hosts (SSRF + RAG poisoning) | [system-audit.md §16 #10](./01-audit/system-audit.md) | Phase 1 | [ ] |
| H-004 | Prompt-injection defense is instruction-only | [system-audit.md §16 #11](./01-audit/system-audit.md) | Phase 5 | [ ] |
| H-005 | `enable_translation=True` default translates every query + every chunk | [system-audit.md §16 #12](./01-audit/system-audit.md) | Phase 5 | [ ] |
| H-006 | No CSP / HSTS / Permissions-Policy headers | [system-audit.md §16 #13](./01-audit/system-audit.md) | Phase 0 | [ ] |
| H-007 | Two Celery startup paths (subprocess in dev, separate service in prod) | [system-audit.md §16 #16](./01-audit/system-audit.md) | Phase 0 | [ ] |
| H-008 | No OpenTelemetry / metrics / traces | [system-audit.md §13](./01-audit/system-audit.md) | Phase 6 | [ ] |
| H-009 | No evaluation harness / frozen benchmark | [system-audit.md §14](./01-audit/system-audit.md) | Phase 6 | [ ] |
| H-010 | No rate limiting on ai-api endpoints | [system-audit.md §11](./01-audit/system-audit.md) | Phase 0 | [ ] |

---

## Implementation phases (Phase 1 onwards — NOT STARTED)

Phases defined in [`phased-roadmap.md`](./03-plans/phased-roadmap.md).

| ID | Phase | Priority | Status | Output |
|---|---|---|---|---|
| IMPL-01 | Phase 0 — Stabilize Current State | P0 | [ ] | Close 7 CRITICAL + selected HIGH gaps |
| IMPL-02 | Phase 1 — Architecture Cleanup | P1 | [ ] | Service boundaries enforced, OTel, structured logs |
| IMPL-03 | Phase 2 — Domain Model | P0 | [ ] | Prisma migrations: mastery, memory, episodes |
| IMPL-04 | Phase 3 — Memory | P0 | [ ] | MemoryService + extraction policy + decay |
| IMPL-05 | Phase 4 — Learner Model | P0 | [ ] | MasteryService + MisconceptionDetector |
| IMPL-06 | Phase 5 — Adaptive Policy | P0 | [ ] | AdaptivePolicyService (deterministic) |
| IMPL-07 | Phase 6 — Agent Integration | P0 | [ ] | Tutor endpoint + decision trace |
| IMPL-08 | Phase 7 — Evaluation | P1 | [ ] | QuizEvaluationService + frozen benchmark |
| IMPL-09 | Phase 8 — DSPy | P2 | [ ] | AdaptiveTutor module + teleprompter |
| IMPL-10 | Phase 9 — Optimization Gate | P1 | [ ] | AcceptanceGate + canary + rollback |
| IMPL-11 | Phase 10 — Experiments | P2 | [ ] | A/B/C/D experiment harness |
| IMPL-12 | Phase 11 — Observability | P1 | [ ] | OTel wiring + dashboards |
| IMPL-13 | Phase 12 — Production Hardening | P0 | [ ] | WAF, CSP, rate limits, runbook |

---

## Plan-level tasks

| ID | Task | Priority | Status | Plan doc |
|---|---|---|---|---|
| PL-01 | Switch LLM from Gemini to langchain-openai (env-driven) | P1 | [x] | [openai-migration.md](./03-plans/openai-migration.md) |
| PL-02 | Implement `AdaptiveTutor` DSPy program | P2 | [ ] | [dspy-integration.md](./03-plans/dspy-integration.md) |
| PL-03 | Add episode log + decision trace | P1 | [ ] | [target-state.md §4.9](./02-architecture/target-state.md) |
| PL-04 | Build prompt registry with versioning | P1 | [ ] | [self-improving-llm.md §Layer 3](./03-plans/self-improving-llm.md) |
| PL-05 | Implement acceptance gate (correctness + grounding + latency + cost) | P1 | [ ] | [acceptance-criteria.md](./04-operations/acceptance-criteria.md) |
| PL-06 | Build frozen evaluation dataset (50–200 scenarios) | P1 | [ ] | [dspy-integration.md §5](./03-plans/dspy-integration.md) |
| PL-07 | Implement Elo-like mastery update | P0 | [ ] | [learner-state.md §3](./02-architecture/learner-state.md) |
| PL-08 | Implement adaptive policy module (deterministic, no LLM) | P0 | [ ] | [target-state.md §4.4](./02-architecture/target-state.md) |
| PL-09 | Implement 4 typed memory layers | P0 | [ ] | [target-state.md §4.3](./02-architecture/target-state.md) |
| PL-10 | Wire OTel across both services | P1 | [ ] | [failure-modes.md §4](./04-operations/failure-modes.md) |
| PL-11 | Implement teacher override endpoint + table | P2 | [ ] | [safety-guards.md §3](./04-operations/safety-guards.md) |
| PL-12 | Async optimization worker | P1 | [ ] | [self-improving-llm.md §Layer 4–5](./03-plans/self-improving-llm.md) |

---

## Open questions (need owner decision before implementation)

| ID | Question | Decision owner | Plan doc | Decision |
|---|---|---|---|---|
| Q-01 | Mastery formula: Elo-like (recommended) vs BKT vs IRT? | research lead | [learner-state.md §3](./02-architecture/learner-state.md) | _pending_ |
| Q-02 | Memory schema: 3 Postgres tables (episodic/semantic/procedural) + optional Qdrant embedding? | architect | [target-state.md §4.3](./02-architecture/target-state.md) | _pending_ |
| Q-03 | Service boundaries: `api` owns all new DB tables; `ai-api` reads via HTTP. Confirm? | architect | [service-boundaries.md](./03-plans/service-boundaries.md) | _pending_ |
| Q-04 | Optimization cadence: nightly (recommended) or weekly? | ops | [self-improving-llm.md §Layer 4](./03-plans/self-improving-llm.md) | _pending_ |
| Q-05 | Frozen benchmark size: 50 (floor), 200 (comfortable), or larger? | research lead | [dspy-integration.md §5](./03-plans/dspy-integration.md) | _pending_ |
| Q-06 | DSPy optimizer order: BootstrapFewShot → MIPRO → GEPA? | ML lead | [dspy-integration.md §7](./03-plans/dspy-integration.md) | _pending_ |
| Q-07 | LLM provider: OpenAI (recommended) vs keep Gemini vs both behind `LLM_PROVIDER`? | product | [openai-migration.md §2](./03-plans/openai-migration.md) | decided 2026-09-30: OpenAI-compatible LLM, Hugging Face embeddings, no Gemini, no `LLM_PROVIDER` |
| Q-08 | Qdrant embedding dimension: keep 768 (backward-compatible) vs migrate to 1536 (more accurate)? | architect | [openai-migration.md §5](./03-plans/openai-migration.md) | _pending_ |

---

## Risks tracked

See [safety-guards.md §4](./04-operations/safety-guards.md) for the full risk register and mitigations.

Top risks (auto-extracted from plan docs):

| Risk | Severity | Mitigation |
|---|---|---|
| Optimizer mutates production prompt without gate | Critical | Optimizer runs in sandbox; only human-approved candidates deploy |
| Tenant isolation bypass (learner A sees learner B memory) | Critical | All memory queries filter by `userId` at SQL level |
| Mastery oscillation | Medium | Cap K-factor; clamp output; golden vector tests |
| Memory extraction LLM hallucinates trait | Medium | Confidence-based write; require ≥3 observations |
| Policy module produces degenerate strategy | High | Property tests; min-challenge guard |
| DSPy optimization overfits to eval | Medium | Frozen benchmark separates from training; human approval |
| RAG poisoning via uploaded PDF | High | URL allow-list + content-type + size cap; quarantine |
| Production regression after canary | High | Auto-rollback on metric regression > 10% in 1h |

---

## How to update this tracker

1. When a planning doc is written, flip its `[ ]` to `[x]` in the **Documentation deliverables** table.
2. When implementation begins, add rows under **Implementation phases**.
3. When a CRITICAL/HIGH issue is fixed, flip its status to `[x]`.
4. When a risk materializes, add a row under **Risks tracked**.
5. When an owner decision is made, fill the **Decision** column in **Open questions**.
6. Never delete rows from this file. Append `SUPERSEDED:` notes if scope changes.

---

## Verification of planning completeness

The planning phase is complete when:

- [x] Every CRITICAL finding has a corresponding `IMPL-*` task.
- [x] Every HIGH finding has a corresponding `IMPL-*` task.
- [x] Every `IMPL-*` task has a linked plan document.
- [x] Every plan document has acceptance criteria.
- [x] Every risk has a mitigation in a plan document.
- [x] Every open question has a decision owner.
- [x] `AGENTS.md` Service Ownership section is in place.
- [x] This progress file is current.

---

## Strategy planning (2026-10-02)

Rows added by the strategy planning job (`docs/strategy/`). Prefix `SP-`. No existing row was changed.

| ID | Task | Priority | Status | Owner | Evidence |
|---|---|---|---|---|---|
| SP-001 | Verification delta: S-01 to S-20, K-01 to K-12, commits, capability inventory, tracks, tests | P0 | [x] | architect | [01-verification-delta.md](./strategy/01-verification-delta.md) |
| SP-002 | Decision register D-01 to D-21 with defaults | P0 | [x] | owner | [decision-register.md](./strategy/decision-register.md) |
| SP-003 | Executive summary | P1 | [x] | owner | [00-executive-summary.md](./strategy/00-executive-summary.md) |
| SP-004 | Business model, canvas, unit-economics skeleton | P1 | [x] | product-strategist | [02-business-model.md](./strategy/02-business-model.md) |
| SP-005 | Actors, stage ladder, journeys | P1 | [x] | product-strategist | [03-actors-and-journeys.md](./strategy/03-actors-and-journeys.md) |
| SP-006 | Business processes BP-01 to BP-12 | P1 | [x] | process-architect | [04-business-processes.md](./strategy/04-business-processes.md) |
| SP-007 | Circular economy loops, KPIs, guardrails | P1 | [x] | product-strategist | [05-circular-economy.md](./strategy/05-circular-economy.md) |
| SP-008 | Accounting domain and sandbox reconciliation | P1 | [x] | accounting-architect | [06-accounting-domain.md](./strategy/06-accounting-domain.md) |
| SP-009 | AI architecture and decision authority matrix | P1 | [x] | ai-architect | [07-ai-architecture.md](./strategy/07-ai-architecture.md) |
| SP-010 | Gamification and dynamic theme | P2 | [x] | product-architect | [08-gamification-and-theme.md](./strategy/08-gamification-and-theme.md) |
| SP-011 | Gap analysis | P0 | [x] | architect | [09-gap-analysis.md](./strategy/09-gap-analysis.md) |
| SP-012 | Target architecture and regenerated responsibility matrix | P1 | [x] | architect | [10-target-architecture.md](./strategy/10-target-architecture.md) |
| SP-013 | API system plan | P1 | [x] | api-architect | [11-api-plan.md](./strategy/11-api-plan.md) |
| SP-014 | UI system plan | P1 | [x] | ux-architect | [12-ui-plan.md](./strategy/12-ui-plan.md) |
| SP-015 | Data model delta | P1 | [x] | data-architect | [13-data-model-delta.md](./strategy/13-data-model-delta.md) |
| SP-016 | Canonical roadmap | P0 | [x] | owner | [14-roadmap.md](./strategy/14-roadmap.md) |
| SP-017 | Risk register | P1 | [x] | owner | [15-risks.md](./strategy/15-risks.md) |
| SP-018 | Owner confirms D-01, D-08, D-05, D-12, D-13 | P0 | [ ] | owner | [decision-register.md](./strategy/decision-register.md) |
| SP-019 | Stage 0 fixes: nginx prefix, web URLs, `ai-api` caller validation, `AI_URL`, curriculum read gate | P0 | [ ] | developer | [14-roadmap.md](./strategy/14-roadmap.md) Stage 0 |
| SP-020 | Repair 161 broken doc links; regenerate `AUTHORIZATION_MATRIX.md` (273 routes) | P1 | [ ] | developer | [01-verification-delta.md](./strategy/01-verification-delta.md) §8 |
| SP-021 | Run the database integration suites on a scratch database in CI | P0 | [ ] | developer | [09-gap-analysis.md](./strategy/09-gap-analysis.md) G-T-03 |
