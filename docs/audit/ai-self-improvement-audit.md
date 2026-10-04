# AI Self-Improvement Audit

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-04`
>
> Inventory and assessment of the AI service's self-improvement loops and infrastructure. Master prompt §64–§80, §117 set the requirements. Source: `services/ai-api/` at HEAD `a868095`. There is no optimizer, no DSPy, no candidate store, no canary infrastructure in `services/ai-api/`.

## 1. Three-loop structure (master prompt §65)

| Loop | Cadence | Status in ai-api |
|---|---|---|
| Fast learner adaptation | per interaction | `MISSING` at ai layer; the application API updates mastery and misconceptions per LearningEvent |
| Medium-term policy analysis | daily / weekly | `MISSING`; no scheduler, no analysis job |
| Slow system optimization | weekly / monthly | `MISSING`; no optimizer, no candidate store, no human approval flow |

The application API has the `Episode` and `DecisionTrace` tables (api-business-flow-traceability.md) and the `OptimizationRun` model, but the ai-api doesn't write to any of them in the self-improvement sense.

## 2. Optimizer stage readiness (master prompt §68)

The preconditions for DSPy are:

```text
episode log
decision trace
frozen benchmark
evaluator
prompt registry
typed tutor interface
baseline metrics
```

| Precondition | Status |
|---|---|
| Episode log | `MISSING` (ai does not write episodes) |
| Decision trace | `PARTIAL` (router_endpoint writes a thin trace; no reasonCodes) |
| Frozen benchmark | `MISSING` |
| Evaluator | `MISSING` |
| Prompt registry | `MISSING` |
| Typed tutor interface | `MISSING` (router_endpoint returns a free-form dict) |
| Baseline metrics | `N/A` (no evaluator to set them) |

**Finding**:

- AI-SELF-01: none of the preconditions are met. DSPy is not installed in `services/ai-api/`. Master prompt §68 / §115. Severity: not yet applicable (the foundation must land first).

## 3. DSPy program (master prompt §69)

`dspy` is not in the dependency tree (verified via `services/ai-api/v1/agents/`, no `import dspy` anywhere). The repository's own audit (`docs/audit/agent-architecture-current.md` §6) confirms "evaluation is heuristic." A `AdaptiveTutor` module with the §69 inputs (systemPolicy, educationalPolicy, domainContext, curriculumContext, learnerState, memory, currentTask, adaptiveStrategy, retrievedEvidence) does not exist.

**Finding**: AI-SELF-02: DSPy module missing. Severity: not yet applicable.

## 4. Optimization dataset separation (master prompt §70)

None. There is no `OptimizationDataset` table or service in the ai-api.

**Finding**: AI-SELF-03: no separation. Severity: not yet applicable.

## 5. Baseline (master prompt §71)

`active prompt version` does not exist. The LLM is called with `pipeline.llm.invoke(prompt)` directly. There is no `PromptVersion` registry; no `modelVersion`; no `retrieval configuration` version.

**Finding**: AI-SELF-04: no baseline. Severity: HIGH (master prompt §71).

## 6. Candidate (master prompt §72)

No candidate structure exists. The current `DecisionTrace` is the closest thing but it lacks `candidateId`, `basePromptVersion`, `benchmarkVersion`, `modelVersion`, `trainingDataVersion`, `candidateMetrics`, `baselineMetrics`, `failureModesTargeted`.

**Finding**: AI-SELF-05: no candidate structure. Severity: HIGH.

## 7. Acceptance gate (master prompt §73)

The seven criteria:

```text
correctness >= baseline
grounding >= baseline
pedagogy >= baseline
personalization >= baseline
hallucination_rate <= baseline × 1.05
p95_latency <= baseline × 1.10
cost_per_1k <= baseline × 1.20
```

There is no `baseline` to compare against. The first run will set the baseline.

**Finding**: AI-SELF-06: no acceptance gate. Severity: not yet applicable.

## 8. Human approval (master prompt §75)

There is no `admin/optimization-runs/:id/approve` endpoint in the ai-api. The router endpoint does not consult a `decidedBy` principal.

**Finding**: AI-SELF-07: no human approval flow. Severity: HIGH (master prompt §75 — production change requires a human principal).

## 9. Canary (master prompt §76)

None. The router endpoint does not split traffic by version. The ai-api has no traffic splitter. Master prompt §76: 95% active / 5% candidate.

**Finding**: AI-SELF-08: no canary. Severity: not yet applicable.

## 10. Rollback (master prompt §77)

No automatic rollback exists. A regression is not detected because there is no benchmark to detect it against. Master prompt §77: "regression > 10% within 1 hour → rollback."

**Finding**: AI-SELF-09: no rollback. Severity: not yet applicable.

## 11. Prompt version registry (master prompt §78)

None. The LLM is called with an inline `prompt` string. There is no `PromptVersion` table in the ai-api schema. There is no hash, no version, no addressability.

**Findings**:

- AI-SELF-10: prompts are inline strings, not versioned. Master prompt §78. Severity: HIGH.
- AI-SELF-11: no `DRAFT` / `EXPERIMENTAL` / `VALIDATED` / `ACTIVE` / `REJECTED` / `ROLLED_BACK` / `ARCHIVED` lifecycle. Severity: HIGH.

## 12. Policy version registry (master prompt §79)

None. The application API has the `AdaptivePolicyService` but the ai-api does not consume it; the `policyVersion` is not threaded into the prompt.

**Findings**:

- AI-SELF-12: no `policyVersion` in the prompt. Master prompt §79. Severity: HIGH.
- AI-SELF-13: the agent endpoint's `promptHash` is a sha256 of something, but not a version. Severity: LOW.

## 13. Self-improvement safety (master prompt §80)

Because no self-improvement runs, the boundary is vacuously satisfied. The boundary is documented in master prompt §80:

```text
authorization
financial rules
accounting engine
evaluation benchmark
security guards
memory isolation
tenant isolation
system policy
educational safety policy
```

None of these are touched by current ai-api code.

**Finding**: AI-SELF-14: safety boundary vacuously satisfied (no production change today).

## 14. Failure mining (master prompt §66)

None. The `DecisionTrace` is the only signal. There is no clustering, no dominant-pattern detection, no improvement-hypothesis generator. Master prompt §66 lists the failure categories (WRONG_ANSWER, WRONG_DIFFICULTY, WRONG_STRATEGY, WEAK_GROUNDING, MISSING_CITATION, BAD_PERSONALIZATION, MEMORY_MISS, MEMORY_FALSE_POSITIVE, TOOL_ERROR, DOMAIN_ERROR, OVER_SCAFFOLDING, UNDER_SCAFFOLDING, EXCESSIVE_VERBOSITY, HALLUCINATION) — none are implemented.

**Findings**:

- AI-SELF-15: no failure clustering. Severity: HIGH.
- AI-SELF-16: the failure categories are not even in a source file; they live only in the master prompt. Severity: MEDIUM.

## 15. Do-not-optimize list (master prompt §67)

Master prompt lists what the optimizer must not change:

- system policy
- educational safety rules
- financial rules
- assessment truth
- mastery formula
- memory persistence policy
- authorization
- security

The ai-api currently does not change any of these (it has no optimizer). Severity: PASS for absence.

## 16. Research experiments (master prompt §81)

Four-arm experiment design:

- A: static tutor
- B: + learner model
- C: + memory
- D: + adaptive policy + DSPy

No `Experiment` / `ExperimentRun` service in the ai-api. No `population` / `treatment` / `control` / `metrics` / `analysis` / `confidence interval` infrastructure.

**Finding**: AI-SELF-17: no experiment infrastructure. Severity: not yet applicable.

## 17. Personalization experiments (master prompt §82)

No A/B testing scaffolding. The path generation prompt is single-pass.

**Finding**: AI-SELF-18: no A/B test. Severity: not yet applicable.

## 18. Gamification experiments (master prompt §83)

The application API has the gamification engine. The ai-api does not measure reward effectiveness.

**Finding**: AI-SELF-19: no AI-side gamification experiment. Severity: not yet applicable.

## 19. Required next-step

For Phase 9 (Self-Improvement), the ai-api needs to:

1. Add a `frozen_benchmark.py` module with ≥ 50 accounting scenarios (master prompt §60).
2. Add a `grader.py` module with an independent prompt version that scores on the §58 dimensions.
3. Add a `prompt_registry.py` with the §78 lifecycle states.
4. Add a `policy_registry.py` with versioned policies.
5. Add an `optimizer.py` that reads episodes, generates candidate prompt versions, runs the benchmark, and compares to baseline.
6. Add `Episode` and `DecisionTrace` write-back from the agent endpoint so the optimizer has data to learn from.
7. Add a `failure_miner.py` that clusters `DecisionTrace` records by the §66 categories.

These are scoped to Phase 9 per master prompt §115.

## 20. Summary scorecard (AI-SELF)

| Area | Status |
|---|---|
| Loop A (fast learner) | `MISSING` |
| Loop B (medium policy) | `MISSING` |
| Loop C (slow optimization) | `MISSING` |
| Optimizer preconditions (episodes, traces, benchmark, evaluator, prompt registry, baseline) | `MISSING` |
| DSPy | `NOT INSTALLED` |
| Optimization dataset separation | `MISSING` |
| Baseline | `MISSING` |
| Candidate structure | `MISSING` |
| Acceptance gate | `MISSING` |
| Human approval flow | `MISSING` |
| Canary / traffic split | `MISSING` |
| Rollback | `MISSING` |
| Prompt version registry | `MISSING` |
| Policy version registry | `MISSING` |
| Self-improvement safety boundary | `PASS` (vacuous) |
| Failure mining | `MISSING` |
| Failure categories in source | `MISSING` |
| Experiment infrastructure | `MISSING` |
| A/B testing | `MISSING` |
| AI-side gamification experiments | `MISSING` |

## 21. Cross-references

- `ai-foundation-audit.md`
- `ai-agent-audit.md`
- `ai-memory-audit.md`
- `ai-rag-audit.md`
- `ai-evaluation-audit.md`
- `api-business-flow-traceability.md` BF-014, BF-015
- `docs/audit/agent-architecture-current.md` (existing agent audit, confirms linear pipelines + heuristic evaluation)
