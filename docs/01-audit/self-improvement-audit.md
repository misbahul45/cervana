# Self-Improvement Audit — Episode to Promote/Rollback

> **Status**: `stable` · **Owner**: `ml-lead` · **Last reviewed**: `2026-10-09`
>
> Whether any reachable loop turns observed interactions into a safer, approved, measured change in how the system teaches.

---

## Scope

Episode and decision-trace capture, evaluation, failure mining, candidate generation, frozen benchmark, acceptance gate, human approval, canary, rollback, prompt and policy registries, experiments, and DSPy. A class named `Optimizer` is not evidence of a loop; the test applied is a reachable chain across all stages.

## Findings

### Chain reachability

Target chain: Episode → Evaluation → Failure → Candidate → Benchmark → Acceptance → Human → Canary → Rollback/Promote.

| Stage | Where it exists | Registered / reachable | Persisted | Status |
|---|---|---|---|---|
| Episode | api `Episode` model and `POST /internal/episodes`; `TutorService` writes its own | endpoint reachable; every ai-api producer is rejected (C-001); `TutorService` rows are real but come from the deterministic tutor | Postgres | `BROKEN` for ai-api, `PARTIAL` for api |
| Decision trace | api `DecisionTrace`, `POST /internal/decision-traces`, `POST /agents/decision-trace/record` | same as above | Postgres | `BROKEN` / `PARTIAL` |
| Evaluation | ai-api `DeterministicEvaluator`; api `PerInteractionEvaluatorService` | neither reachable | none / `InteractionEvaluation` | `UNWIRED` |
| Failure mining | `services/ai-api/v1/optimization/failure_mining.py` (178 lines, categories and dominant-pattern templates) | not reachable | in-memory | `UNWIRED` |
| Candidate generation | none for prompts; `routing_policy.py` (237 lines) builds candidate **routing** policies and uses the approval and canary classes | not reachable | in-memory dicts (`routing_policy.py:51-55`) | `UNWIRED` |
| Frozen benchmark | ai-api 54 scenarios (constant); api `FrozenBenchmarkService` | not reachable | none / `EvaluationDataset` | `UNWIRED` |
| Acceptance gate | ai-api `acceptance_gate.py` (component metrics ≥ baseline, hallucination ≤ 1.05×, p95 ≤ 1.10×, cost per 1k ≤ 1.20×); api `evaluateGate` (`ACCEPTANCE_GATES`: pass-rate gain ≥ 0.05, p95 ≤ 1.5×, cost ≤ 1.5×, acceptance rate ≥ 0.7) | neither reachable | none / none | `UNWIRED` |
| Human approval | ai-api `HumanApprovalRegistry` (`submit`, `approve`, `reject`, `is_approved`) | not reachable | in-memory dict (`human_approval.py:35`) | `UNWIRED` |
| Canary | ai-api `canary.py` (95% active / 5% candidate, `candidate_ratio=0.05`); api `recordCanaryResult` | not reachable | in-memory / `PromptVersion.metricsJson` | `UNWIRED` |
| Rollback | ai-api `rollback.py` (window `WINDOW_SECONDS = 3600`, relative drop per dimension); api `autoRollbackOnRegression` (≥ 100 samples and pass rate < 0.55) | not reachable | in-memory / status column | `UNWIRED` |
| Prompt registry | ai-api `registry.py` (`PromptRegistry`, `PromptStatus`, `transition`, `history`); api `PromptVersion` with `PromptStatus {DRAFT, EXPERIMENTAL, VALIDATED, ACTIVE, REJECTED, ROLLED_BACK, ARCHIVED}` (model at `schema.prisma:1296`) | neither reached by the runtime; no production prompt is loaded by version | in-memory / Postgres | `UNWIRED` |
| Policy registry | `PolicyVersion` table (`schema.prisma:1312`) | no code | none | `SCAFFOLDED` |
| Experiments | ai-api `research/experiment.py`, `runner.py` (experiment arms, e.g. `D_FULL_STACK`; runner internals not read); `Experiment`, `ExperimentRun`, `OptimizationRun` tables | not reachable; tables unused | in-memory | `UNWIRED` |
| DSPy optimizer (BootstrapFewShot, then MIPRO/GEPA) | none | `dspy` is not in `services/ai-api/pyproject.toml` and is not imported; the string appears once as an arm label (`research/experiment.py:24`) | n/a | `MISSING` |

The ai-api implementation matches the specified gate, canary share and rollback window; it is in-memory and has no caller. The api implementation has a persistent registry with the specified status enum and looser gates.

### H-003

**Episode and trace content is not measured.** The producers fill the records with constants or nothing:

| Field | Value written | Evidence |
|---|---|---|
| `tokens_in`, `tokens_out`, `cost_usd`, `latency_ms` | `None` for generate-material and chat | `services/ai-api/v1/learning/workers.py:132-135` (the router measures attempt latency, but `RoutedResult` is not used for the episode on the material path, and token usage is never read from the model response, `config/model_router.py:309-335`) |
| `prompt_version`, `policy_version`, `model` | not sent; the api stores `unknown-v0` | `services/api/src/v1/internal/internal-episodes.controller.ts` schema defaults |
| `prompt_hash` | `sha256("<lesson>|<step>|<topic>")`, not the prompt (chat: `sha256("chat|<userStep>|<session>")`) | `workers.py:153-156,259` |
| `tool_calls` | always `rag_retrieve` and `web_search`, for both flows | `workers.py:157-160,261-264`; RAG returns nothing (C-002) and web search is disabled without a key (M-015) |
| `reason_codes` | `["PHASE_1_FOUNDATION"]` on the material path | `workers.py:167` |
| retrieved chunks and memory | not sent | `EpisodeCreate` in `workers.py:107-139` has citations only |
| Chat trace | `policy_version`, mode, escalation and attempt count are recorded | `workers.py:265-273` (the only measured fields) |

A trace that lists tools which were not used, with a constant reason, and an episode without cost or latency cannot support evaluation, failure mining or a cost gate. In addition, both writers are rejected by the api today (C-001), the resource-ingestion worker writes no episode, the `users_steps` worker writes through the same unsigned client, and the api `TutorService` episodes record `modelName = 'reducera-tutor-deterministic'` and `promptVersion = 'tutor.v1'` for a template reply.

### H-007

**The improvement packages are unreachable and in-memory; the optimizer does not exist.** `evaluation`, `optimization`, `gamification` and `research` in ai-api (24 modules, about 3,640 lines, 140 tests) are imported by no production module. A search of these packages for `requests`, `httpx`, `open(`, database, Redis or Qdrant clients found none: approvals, candidates and registries are Python dictionaries. A restart, or a second process (uvicorn versus the Celery worker), sees different state. The api counterparts (`PerInteractionEvaluatorService`, `FrozenBenchmarkService`, `PromptOptimizationService`) are provided by no `@Module`. `PromptOptimizationService` also writes status values that are not members of `PromptStatus`: `'CANARY'` (`prompt-optimization.service.ts:104-108`) and `'PUBLISHED'` (`:147-150`), hidden by `as never` casts; Prisma would reject those writes. The three improvement loops (per interaction, policy, prompt) therefore have: loop A (event → mastery → misconception → memory → policy → next experience) broken at the event store (H-006) and at the prompt (H-004); loop B (policy experiments) absent; loop C (prompt candidates) absent.

### Safety properties that do hold in design

| Property | Where | Reachable |
|---|---|---|
| No automatic activation: approval is a separate state | `human_approval.py`; api `promote({approvedBy})` | no |
| Optimizer boundary guard (what it may not touch) | `services/ai-api/v1/optimization/safety.py` (130 lines; name and size only, contents not read) | no |
| Frozen scenarios separated from optimization data | package boundary only | no |

These are design assets; none constrains a running system.

## Evidence citations

- `services/ai-api/v1/optimization/{acceptance_gate,canary,rollback,human_approval,registry,failure_mining,routing_policy,safety,baseline}.py`
- `services/ai-api/v1/research/{experiment,runner}.py`; `services/ai-api/v1/learning/workers.py:107-172,229-278`
- `services/api/src/v1/optimization/prompt-optimization.service.ts:13-18,26-150`; `services/api/src/v1/evaluation/evaluation.service.ts`
- `services/api/prisma/schema.prisma:1296-1376` (`PromptVersion`, `PolicyVersion`, `Experiment`, `ExperimentRun`, `EvaluationDataset`, `OptimizationRun`)
- `services/ai-api/pyproject.toml` (no `dspy`); import graph (26 unreachable modules)

## Verdict

There is no self-improving loop in this system. Each stage has a unit-tested component somewhere, the most faithful ones in ai-api, but no stage is connected to a running path and the first stage, the episode, is both rejected by the api and filled with unmeasured values. DSPy is not present. Building the loop starts at observability: signed episode writes, measured cost, latency, tokens and versions, and a prompt that is loaded by version at runtime.
