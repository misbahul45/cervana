# PHASE 0 Audit Index — services/ai-api

**Audit date:** 2026-10-05
**Scope:** `services/ai-api` only (FastAPI on :3003). Out of scope: `services/api` (NestJS on :3002) which holds the authoritative business state.
**Method:** Map-and-list with `file:line` evidence. Every claim cites a path or is marked `MISSING`.
**Authority:** Master Prompt for ReduCera AI §105, §106.

---

## Documents in this folder

| # | File | Master-prompt section | Headline |
|---|---|---|---|
| 1 | `ai-foundation-audit.md` | §107 | Service auth, contracts, config, output, trace, error, budgets, episode store, decision trace |
| 2 | `ai-domain-audit.md` | §108 | Accounting domain layer, ontology, validators, misconceptions, tool surface |
| 3 | `ai-personalization-audit.md` | §109 | LearningEvent, mastery, confidence, misconceptions, learner state, adaptive policy |
| 4 | `ai-memory-audit.md` | §110 | Working/episodic/semantic/procedural memory, write policy, decay, isolation |
| 5 | `ai-rag-audit.md` | §24–§27, §40, §92 | Chunking, retrieval, citations, security, SSRF |
| 3 | `ai-agent-audit.md` | §36–§40, §86, §89–§90 | Dispatcher, agents, tool registry, agent loop, budgets |
| 7 | `ai-evaluation-audit.md` | §57–§63, §114 | Independent evaluator, frozen benchmark, dimensions, calibration |
| 8 | `ai-self-improvement-audit.md` | §64–§80, §115–§116 | DSPy, prompt registry, canary, rollback, experiments |
| 9 | `ai-gamification-audit.md` | §50–§56, §113, §121 | RewardEngine, ledger, no-farming, leaderboard, narration |

---

## Cross-Cutting Headlines

### Things that exist and are correct

```text
1. PromptSegmentation with trust fences (system/immutable, retrieved/untrusted, user/untrusted)
   └── services/ai-api/config/prompt_segmentation.py:88-161
2. Instruction-injection defense at THREE boundaries (memory write, web search, retrieved chunks)
   └── utils/tools/memory.py:86-90; utils/tools/web_search.py:37-40; config/prompt_segmentation.py:19-39
3. Lesson-scoped memory isolation with strict and fallback variants
   └── utils/tools/memory.py:13-78
4. Deterministic agent dispatcher (no LLM in routing)
   └── v1/agents/router.py:7-32
5. Signed internal contract client (HMAC-SHA256) for ai-api → api
   └── config/service_auth.py:22-89
6. Structured output for quiz generation (Pydantic validation post-LLM)
   └── v1/users_steps/generate_quiz_pipeline.py:147-151
7. URL allow-list for SSRF defense on PDF extraction
   └── config/url_allowlist.py:34-105; v1/resources/service.py:112-133
8. Qdrant collection dimension guard (refuses boot on stale vector size)
   └── config/vector_collections.py:13-19
9. LLM call timeout (60s) and bounded retries (2)
   └── config/providers.py:18-19, 122-125
10. LangGraph state graphs for tutor, learning-path, quiz pipelines
    └── v1/learning/content_pipeline.py:254-271; v1/users_steps/generate_user_steps_pipeline.py:372-395
```

### Critical defects (must fix in Phase 1)

| Severity | Defect | Source |
|---|---|---|
| CRITICAL | Raw bearer token forwarded into Celery payload (master prompt §3.3) | foundation §15 |
| CRITICAL | `NameError: user_step_title` in chat worker fallback string | foundation §15 |
| HIGH | All tutor routes lack `Idempotency-Key` requirement | foundation §8 |
| HIGH | No trace_id propagation through Celery or LangGraph | foundation §7 |
| HIGH | No episode store creation in ai-api | foundation §10 |
| HIGH | No decision trace written by learning or users-steps paths | foundation §10 |
| HIGH | `tutor_agent` and `assessment_agent` are aliases to `run_curriculum`; no real LLM streaming yet | agent §2 |
| HIGH | Tool-side `decision-trace` POST in `/v1/agents/run` does not include trace_id and silently swallows errors | agent §10 |
| HIGH | Memory test file `test_memory.py` is COLLECT-IGNORED (pytest never runs it) | memory §13 |
| MEDIUM | No `@rate_limit` on tutor endpoints | foundation §9 |
| MEDIUM | Bare `except:` blocks silently mask API failures as empty results | foundation §9, rag §6 |

### Architectural soundness that the implementation still lacks

```text
1. Typed accounting domain (Concept, Prerequisite, Rule, Procedure, Misconception, Validator)
2. Adaptive learner model (Mastery, Confidence, Misconception evidence pipeline)
4. Adaptive Policy Service with PolicyVersion and golden-vector tests
5. Three improvement loops (per-interaction learner / weekly policy / monthly system)
6. Frozen 50-scenario accounting benchmark + independent evaluator
7. DSPy AdaptiveTutor module, candidate gate, canary, rollback
8. RewardEngine + GamificationLedger consumers in ai-api (none, by design)
9. Episode store with episodeId, decisionTrace, promptVersion, policyVersion, token/cost/latency
10. Tool registry with permissionClass, sideEffects, requiredScopes, riskLevel
```

---

## Phase → Audit Crosswalk

```text
Phase 1  AI Foundation (§107)            →  foundation audit
Phase 2  Accounting Domain (§108)         →  domain audit
Phase 3  Learner Model (§109)             →  personalization audit
Phase 4  Memory (§110)                    →  memory audit
Phase 5  Adaptive Policy (§111)           →  personalization audit §8, agent audit §5
Phase 6  Personalized Tutor (§112)        →  agent audit + rag audit + memory audit + domain audit
Phase 7  Gamification (§113)              →  gamification audit
Phase 8  Evaluation (§114)                →  evaluation audit
Phase 9  Self-Improvement (§115)          →  self-improvement audit
Phase 10 Research Loop (§116)             →  self-improvement audit §10
```

---

## Severity Rubric Used in Every Audit

```text
CRITICAL  security boundary, data corruption, broken contract, hard-to-reverse
HIGH      missing required primitive, silent failure, large blast radius
MEDIUM    style/inconsistency, partial implementation, dead code, no test coverage
LOW       nit, naming, refactor opportunity
MISSING   explicitly absent in the codebase (no file, no class, no DTO)
PRESENT   verified file:line exists and matches expectation
INERT     exists but does not actually run / is shadowed / is unreachable
```

---

## What's Next

After you authorize, Phase 1 work begins per `phase-1-implementation-plan.md` in this folder.