# AI Evaluation Audit

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-04`
>
> Inventory and assessment of the AI service's evaluation, frozen benchmark, and independence guarantees. Master prompt §57–§63, §73, §100, §114 set the requirements. Source: `services/ai-api/` at HEAD `a868095`. The application API has the `Episode` and `DecisionTrace` tables but no `EvaluationDataset` or `FrozenBenchmark` (api-business-flow-traceability.md).

## 1. Required inventory (master prompt §60–§63)

| Item | Status | Evidence |
|---|---|---|
| Frozen benchmark with ≥ 50 scenarios | `MISSING` | no `evaluation_dataset` table, no `frozen_benchmark.py` in ai-api |
| Independent evaluator (own prompt version) | `MISSING` | no `evaluator` service |
| LLM-as-judge with rubric | `MISSING` | no rubric service; `tutor` prompt has no JSON output |
| Grader agreement with human labels (Cohen's κ ≥ 0.85) | `NOT MEASURED` | no benchmark, no human labels, no grader |
| Nightly benchmark run | `MISSING` | no scheduler, no nightly job |
| Component metrics (correctness, grounding, pedagogy, personalization, hallucination) | `MISSING` | no evaluator |
| Optimizer cannot modify frozen benchmark | `N/A` (no benchmark exists) | — |
| Human approval required for ACTIVE | `N/A` (no prompt versions in registry) | — |
| `agentScope` field on each decision | `PARTIAL` | `router_endpoint.py` records it from the request intent |
| Episode record per production tutor interaction | `MISSING` | the table exists in api but ai does not write |

The repository's own audit (`docs/audit/agent-architecture-current.md` §6) confirms "evaluation is heuristic; no benchmark." The Phase 1/2 audit (`docs/strategy/01-verification-delta.md` §F-05) confirms the same.

## 2. Existing tests as informal evaluation

The ai-api has a `test_tutor_citation.py` and a `test_rag_recall.py`. These are integration tests of the citation field and of the RAG recall. They are not a benchmark; they are unit tests.

**Findings**:

- AI-EVAL-01: the `citatetions` field is hardcoded empty in `content_pipeline.py:207`, so `test_tutor_citation.py` is asserting that a deliberately-broken path produces a deliberately-empty array. The test passes, but the production path is broken. Severity: HIGH (the test gives false confidence).
- AI-EVAL-02: `test_rag_recall.py` uses a hard-coded in-memory fixture. The fixture does not match the production pipeline (the LLM is mocked, the Qdrant store is mocked). Severity: MEDIUM.
- AI-EVAL-03: there is no benchmark for the LLM-as-judge path. Master prompt §63: "Cohen's κ ≥ 0.85" — not measured. Severity: MEDIUM.

## 3. Episode store at the AI layer (master prompt §42)

The application API has the `Episode` table. The AI does not create episodes. The `DecisionTrace` is written by `router_endpoint.py:45-58` (a thin trace record, not a full episode).

**Findings**:

- AI-EVAL-04: the AI never creates an `Episode`. Master prompt §42 requires episodes for self-improvement. Severity: HIGH.
- AI-EVAL-05: even if episodes existed, there is no failure-mode classifier (master prompt §66) at the AI layer. Severity: MEDIUM.

## 4. Optimizer stage (master prompt §68)

DSPy is not installed in `services/ai-api/`. The pre-existing audit (`docs/audit/agent-architecture-current.md` §6) confirms "evaluation is heuristic." Master prompt §68 requires the foundation (episode log, decision trace, frozen benchmark, evaluator, prompt registry, baseline metrics) to be stable before DSPy. None of those are present.

**Findings**:

- AI-EVAL-06: DSPy is not in the dependency tree. Master prompt §68. Severity: not yet applicable.
- AI-EVAL-07: prompt versions are not versioned. The LLM is called with `pipeline.llm.invoke(prompt)` directly; no `PromptVersion` registry. Master prompt §78. Severity: HIGH.
- AI-EVAL-08: no human-approval gate. The router endpoint immediately returns the LLM result; no `PromptVersion` is bumped from `DRAFT` to `ACTIVE`. Master prompt §75. Severity: HIGH.
- AI-EVAL-09: no `decidedBy` field is sent in the trace. Master prompt §75 (every candidate must carry a `decidedBy` from a human principal). Severity: HIGH.

## 5. Acceptance gate (master prompt §73)

The acceptance criteria are: `correctness >= baseline`, `grounding >= baseline`, `pedagogy >= baseline`, `personalization >= baseline`, `hallucination_rate <= baseline × 1.05`, `p95_latency <= baseline × 1.10`, `cost_per_1k <= baseline × 1.20`.

The AI has no `baseline` because no evaluation has run. The first run will set it. There is no `optimization run` infrastructure, no `candidateMetrics`, no `baselineMetrics`.

**Findings**:

- AI-EVAL-10: there is no comparison between a candidate and a baseline. The first acceptance gate will be set by the first run. Severity: not applicable (no candidate to evaluate).
- AI-EVAL-11: no per-component metric, no cost-per-1k, no p95 latency capture in the agent endpoint. Master prompt §73. Severity: MEDIUM.

## 6. Optimization data separation (master prompt §70)

None. There is no `OptimizationDataset` table, no separate training / validation / benchmark files. The ai-api has no optimizer reading episodes.

**Findings**:

- AI-EVAL-12: no `optimization_dataset` in ai-api. Master prompt §70. Severity: not yet applicable.
- AI-EVAL-13: no failure-mining. Master prompt §66 lists failure categories; none are implemented. Severity: HIGH.

## 7. Self-improvement safety (master prompt §80)

There is no self-improvement today. When it arrives, the boundary must exclude:

- authorization
- financial rules
- accounting engine
- evaluation benchmark
- security guards
- memory isolation
- tenant isolation
- system policy
- educational safety policy

The ai-api code does not yet touch any of these. Severity: PASS for the absence.

## 8. Research experiments (master prompt §81)

No experiment infrastructure exists. The repository's target designs four arms (static / learner-model / memory / +policy+optimizer), but no Experiment / ExperimentRun table or service is wired.

**Findings**:

- AI-EVAL-14: no `Experiment` or `ExperimentRun` in the ai-api code. Severity: not yet applicable.
- AI-EVAL-15: no `hypothesis` / `population` / `treatment` / `control` / `metrics` / `analysis`. Severity: not yet applicable.

## 9. Personalization experiments (master prompt §82)

None. The ai-api has no A/B testing scaffolding. The path-generation prompt is single-pass.

## 10. Gamification experiments (master prompt §83)

None in ai-api. The gamification engine is at the application API (api-business-flow-traceability.md BF-004). The AI does not measure reward effectiveness.

## 11. AI cost intelligence (master prompt §84)

The `Episode` record should expose `inputTokens, outputTokens, costUsd, latencyMs`. The current `DecisionTrace` does not. The `chat_model.llm.invoke` call has no token-counting wrapper; only `promptHash` is captured.

**Findings**:

- AI-EVAL-16: no `inputTokens` or `outputTokens` captured per call. Master prompt §84. Severity: MEDIUM.
- AI-EVAL-17: no `costUsd` captured. Master prompt §84. Severity: MEDIUM.
- AI-EVAL-18: no `latencyMs` per call. The router endpoint does not time the agent's run. Master prompt §84. Severity: LOW.

## 12. AI failure recovery (master prompt §85)

The LLM call has no try/except (see AI-AGENT audit, AI-AGENT-16). There is no controlled fallback for "LLM unavailable."

**Finding**: AI-EVAL-19: no fallback. Master prompt §85. Severity: MEDIUM.

## 13. Required test inventory (master prompt §96–§100)

### Domain tests (§99)
- balanced journal entry accepted: NO
- unbalanced journal entry rejected: NO (handled by the application API's `AccountingEngineService`)
- invalid account rejected: NO
- multi-step scenario validated: NO
- wrong accounting rule rejected: NO

### Learner tests (§98)
- same learner state → same policy: covered by `services/api/src/v1/personalization/policy/__tests__/adaptive-policy.service.spec.ts` (4 cases)
- low mastery → high scaffolding: NOT IN AI (the application API has the policy; the AI doesn't call it)
- high mastery → challenge: same
- misconception → remediation: same
- high hint dependency → reduced direct-answer: same
- off-topic → no mastery pollution: NOT IN AI

### Memory tests (§97)
- store meaningful event: NO
- reject low-salience: NO
- reject instruction-like: AI-RAG-12 / AI-MEM-10 (rejection happens in segmentation but not in the upsert path)
- confidence threshold: NO
- retrieval ranking: NO (just raw Qdrant score)
- user isolation: PARTIAL (test exists but collection errors)
- lesson isolation: PARTIAL (test exists but collection errors)

### Gamification tests (§101)
- duplicate event → one reward: NO (gamification is at the application API; not relevant to AI)
- scenario replay → no reward: NO
- too-fast completion → no reward: NO

### Self-improvement tests (§100)
- all of the §100 list: NO (no optimizer)

## 14. Summary scorecard (AI-EVAL)

| Area | Status |
|---|---|
| Frozen benchmark (≥ 50 scenarios) | `MISSING` |
| Independent evaluator (own prompt) | `MISSING` |
| LLM-as-judge with rubric | `MISSING` |
| Cohen's κ ≥ 0.85 measured | `NOT MEASURED` |
| Nightly benchmark run | `MISSING` |
| Component metrics | `MISSING` |
| Episode store per interaction (AI writes) | `MISSING` |
| Optimizer can run | `NO` (foundations missing) |
| Prompt versions | `MISSING` |
| Human approval gate | `MISSING` |
| `decidedBy` field on candidate | `MISSING` |
| Optimization dataset separation | `MISSING` |
| Failure mining | `MISSING` |
| Cost / latency capture | `MISSING` (token counts, cost, latency) |
| Self-improvement safety boundary | `PASS` (no production change) |

## 15. Required next-step

For Phase 8 (Evaluation), the AI needs to:

1. Build a `frozen_benchmark.py` module with at least 50 accounting scenarios (master prompt §60) — likely coordinated with the application API's `AccountSandbox` content.
2. Build a `grader.py` module with an independent prompt version that scores candidate responses on the §58 dimensions.
3. Add a nightly scheduler that runs the benchmark against the active prompt version.
4. Capture `inputTokens`, `outputTokens`, `costUsd`, `latencyMs` per LLM call (master prompt §84).
5. Fix the broken `citatetions` typo and the hardcoded empty array (AI-RAG-08, AI-RAG-09).
6. Have the agent endpoint create an `Episode` row per production tutor interaction.

These are scoped to Phase 8 per master prompt §114.

## 16. Cross-references

- `ai-foundation-audit.md`
- `ai-agent-audit.md`
- `ai-memory-audit.md`
- `ai-rag-audit.md`
- `ai-personalization-audit.md`
- `ai-self-improvement-audit.md`
- `api-business-flow-traceability.md` BF-013, BF-014
