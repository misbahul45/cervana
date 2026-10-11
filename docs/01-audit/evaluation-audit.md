# Evaluation Audit — Evaluator, Benchmark, Calibration

> **Status**: `stable` · **Owner**: `ml-lead` · **Last reviewed**: `2026-10-09`
>
> Whether the tutor can be scored by something independent of it, against ground truth that does not move.

---

## Scope

The ai-api `evaluation` package, the api `EvaluationService` and `FrozenBenchmarkService`, the `InteractionEvaluation` and `EvaluationDataset` tables, and the quiz evaluator. Checked against: evaluator independence, evaluated dimensions, a frozen benchmark of at least 50 cases, calibration to human labels (target Cohen's kappa ≥ 0.85), and use of real tutor output.

## Findings

### Components

| Component | Status | Source | Notes |
|---|---|---|---|
| Quiz answer evaluator | `IMPLEMENTED` | `services/api/src/v1/quiz/services/quiz-evaluation.service.ts:21-48` | deterministic per question type; it grades learner answers, not the tutor |
| Rule-based tutor evaluator | `UNWIRED` | `services/ai-api/v1/evaluation/evaluator.py:48-330` (`DeterministicEvaluator`) | heuristic scores from a `TutorOutput` and an `ExpectationRubric` (e.g. correctness from `rubric.expected_concepts` coverage, `:120-121`); optional `LLMJudge` protocol (`:44-45,61`) with no implementation or caller |
| Evaluator independence | `SCAFFOLDED` | `EVALUATOR_PROMPT_VERSION = "evaluator-v1.0.0"` (`:20`) | a version string only: with no LLM judge there is no evaluator prompt, judge configuration or rubric text to keep separate from the tutor's |
| Dimensions | `PARTIAL` | `services/ai-api/v1/evaluation/dimensions.py:8-24` | 7 generic (`CORRECTNESS`, `GROUNDING`, `PEDAGOGY`, `PERSONALIZATION`, `HALLUCINATION`, `LATENCY`, `COST`) and 8 accounting (`CONCEPTUAL_CORRECTNESS`, `CALCULATION_CORRECTNESS`, `DOUBLE_ENTRY_VALIDITY`, `DOMAIN_TERMINOLOGY`, `RULE_CONSISTENCY`, `SCENARIO_INTERPRETATION`, `MISCONCEPTION_HANDLING`, `PREREQUISITE_AWARENESS`). `DIFFICULTY_ALIGNMENT` and `SAFETY` are absent from the enum; the api table has `InteractionEvaluation.difficultyAlign` (`schema.prisma:1283`) |
| Frozen benchmark | `SCAFFOLDED` | `services/ai-api/v1/evaluation/benchmark.py:12,88` | `BENCHMARK_VERSION = "benchmark-v1.0.0"`, 54 `BenchmarkScenario` objects in a Python list. "Frozen" means a frozen dataclass; the only guard is a length assertion (`v1/evaluation/__tests__/test_evaluation.py:138`, `>= 50`). No content hash, no pinned digest, no separation from optimization data beyond the package boundary |
| Benchmark runner | `SCAFFOLDED` | `services/ai-api/v1/evaluation/runner.py:117-136` | with no `output_factory`, every scenario is scored against a canned response (the same sentence about debit/credit, `latency_ms=200`, `cost_usd=0.001`, `tokens 100/200`, a fixed RAG item). No adapter produces output from the real tutor, so any baseline it prints describes the fixture |
| Calibration | `SCAFFOLDED` | `services/ai-api/v1/evaluation/calibration.py:7,24-120` | `cohen_kappa`, Pearson correlation, `calibrate(items)`, `COHEN_KAPPA_THRESHOLD = 0.85`. No human-labeled item exists in the repository (no `HumanLabeledItem(` outside tests; no label file). Any kappa produced is a development value |
| api per-interaction evaluator | `UNWIRED` | `services/api/src/v1/evaluation/evaluation.service.ts:33-118` (`PerInteractionEvaluatorService`) | writes `InteractionEvaluation` and updates the episode; scores are derived from episode fields (`deriveScoresFromEpisode`, `:99`), not from judgment of the answer; no module provides it |
| api frozen benchmark | `UNWIRED` | `evaluation.service.ts:120-195` (`FrozenBenchmarkService.register`, `run`) over `EvaluationDataset` | no module provides it; no dataset row is created by any running path |
| Evaluation of production episodes | `MISSING` | | nothing reads `Episode` rows and scores them on a schedule or on write |

### Ground truth

| Domain | Ground truth available |
|---|---|
| Accounting calculation and double entry | deterministic (api sandbox and simulator) |
| Concept explanation quality | rubrics inside the 54 scenarios; no human adjudication |
| Grounding | not measurable while retrieval returns nothing (C-002) |
| Personalization | no learner state reaches the tutor (H-004), so there is nothing to evaluate |

### What can be evaluated today

Unit-level behavior of the evaluator and the benchmark data structure (29 tests in `v1/evaluation/__tests__`, passing). Not evaluable: the tutor's actual output quality, because no run of the real tutor is captured in a form the evaluator accepts, and the episodes that would hold it carry no tokens, cost, latency, prompt version or retrieved context (H-003).

## Evidence citations

- `services/ai-api/v1/evaluation/{evaluator,dimensions,benchmark,runner,calibration}.py` (lines as cited)
- `services/api/src/v1/evaluation/evaluation.service.ts`; `services/api/prisma/schema.prisma:1275-1295,1348`
- Search for human labels: `HumanLabeledItem(` outside tests, `*.jsonl`, `*label*.json`, `*calibration*.json`, `*.csv` under `services/ai-api` (excluding `.venv`): none
- Tests: `services/ai-api/v1/evaluation/__tests__/test_evaluation.py`

## Verdict

An evaluation toolkit exists on paper in two places and is used in neither. The ai-api package has sensible dimensions, a 54-case benchmark and a kappa routine, but it scores canned output with no judge and no human labels, and nothing calls it. The api package is unregistered. The independence, frozen-benchmark and calibration requirements are therefore not met: the independence is a version string, the freeze is a type annotation, and the calibration has no data.
