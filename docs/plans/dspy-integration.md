# DSPy / GEPA / MIPRO Integration Plan

> **Status**: `planned` · **Owner**: `ml-lead` · **Last reviewed**: `2026-09-30`
>
> Introduce DSPy for prompt optimization, behind a controlled improvement loop. DSPy optimizes the tutoring **program**, not directly the application.

---

## 1. Objective

Use DSPy to optimize the prompt template behind the tutor endpoint, with a frozen evaluation dataset, an acceptance gate, and a human-approval requirement. The goal is reproducible, auditable, reversible prompt improvement.

This plan assumes:

- Phases 1–6 of [`phased-roadmap.md`](./phased-roadmap.md) are stable.
- The episode log + decision trace are wired (Phase 1).
- A frozen evaluation dataset exists (Phase 7).

---

## 2. Scope

Files affected:

- `services/ai-api/pyproject.toml` (add `dspy`)
- `services/ai-api/v1/tutor/dspy_module.py` (new)
- `services/ai-api/v1/tutor/optimizer.py` (new)
- `services/ai-api/v1/tutor/benchmark_runner.py` (new)
- `api/src/v1/optimization/acceptance-gate.service.ts` (new)
- `api/src/v1/optimization/optimization-runner.service.ts` (new)
- `api/src/v1/optimization/canary.service.ts` (new)

---

## 3. Why DSPy (and not manual iteration)

- **Typed signatures** replace freeform string prompts; impossible to forget a field.
- **Optimizer library** (`BootstrapFewShot`, `MIPRO`, `GEPA`) replaces "try a thing and see".
- **Versionable artifacts**: prompts become rows in `PromptVersion` with metrics.
- **Reproducible**: a re-run with same data + same seed produces the same output.

DSPy does **not** magically make the system better. It automates the search and the version control. The actual improvement signal still comes from the eval set and the acceptance gate.

---

## 4. The DSPy signature

```python
import dspy

class TutorSignature(dspy.Signature):
    """Generate a tutoring response for an individual learner."""

    system_policy: str = dspy.InputField(desc="Immutable system policy.")
    educational_policy: str = dspy.InputField(desc="Immutable educational policy.")
    course_context: str = dspy.InputField(desc="Topic, lesson, step.")
    learner_state: str = dspy.InputField(desc="Compact learner state.")
    relevant_memory: str = dspy.InputField(desc="Top episodic/semantic/procedural memories.")
    current_task: str = dspy.InputField(desc="Question or exercise.")
    adaptive_strategy: str = dspy.InputField(desc="Strategy from policy module.")

    reasoning: str = dspy.OutputField(desc="Step-by-step pedagogical reasoning.")
    response: str = dspy.OutputField(desc="Tutor response, educational and grounded.")
```

Each `InputField` maps to a layer in the prompt architecture (see [`docs/02-architecture/target-state.md` §4.5](../02-architecture/target-state.md#45-prompt-architecture)). The optimizer tunes the descriptions and the LM invocation parameters; the layered structure itself stays fixed.

---

## 5. The DSPy module

```python
class AdaptiveTutor(dspy.Module):
    def __init__(self):
        super().__init__()
        self.tutor = dspy.ChainOfThought(TutorSignature)

    def forward(
        self,
        *,
        system_policy: str,
        educational_policy: str,
        course_context: str,
        learner_state: str,
        relevant_memory: str,
        current_task: str,
        adaptive_strategy: str,
    ):
        return self.tutor(
            system_policy=system_policy,
            educational_policy=educational_policy,
            course_context=course_context,
            learner_state=learner_state,
            relevant_memory=relevant_memory,
            current_task=current_task,
            adaptive_strategy=adaptive_strategy,
        )
```

`ChainOfThought` is the simplest optimizer-compatible wrapper. Replace with `dspy.ReAct` or `dspy.ProgramOfThought` only if the offline eval shows clear wins.

---

## 6. Frozen evaluation dataset

Location: Postgres `evaluation_datasets` table, **read-only** for the optimizer. The optimizer reads via a dedicated endpoint that does not allow writes.

Size: 50 scenarios is the floor. 200 is comfortable.

Each example:

```python
{
    "system_policy": str,             # immutable
    "educational_policy": str,        # immutable
    "course_context": str,
    "learner_state": str,             # synthetic but realistic
    "relevant_memory": str,
    "current_task": str,
    "adaptive_strategy": str,
    "expected_response": str,         # human-authored
    "rubric": {
        "correctness": "...",
        "grounding": "...",
        "pedagogy": "...",
        "personalization": "...",
    }
}
```

The dataset covers:

- Different ability levels (beginner, intermediate, advanced).
- Different learning styles (visual, text, worked-example).
- Different topics.
- Failure cases (known misconceptions).
- Adversarial cases (out-of-scope questions, ambiguous tasks).

---

## 7. Metric function

The DSPy metric must mirror the production acceptance gate in [`docs/02-architecture/target-state.md` §4.7](../02-architecture/target-state.md#47-evaluation-framework):

```python
def tutor_metric(example, prediction, trace=None) -> float:
    correctness = grade_correctness(prediction.response, example.expected_response)
    grounding = grade_grounding(prediction.response, example.relevant_memory)
    pedagogy = grade_pedagogy(prediction.response, example.adaptive_strategy)
    personalization = grade_personalization(prediction.response, example.learner_state)
    if min(correctness, grounding, pedagogy, personalization) < 0.6:
        return 0.0
    return 0.4 * correctness + 0.2 * grounding + 0.2 * pedagogy + 0.2 * personalization
```

Each component grade is itself an LLM-as-judge call. The metric is intentionally a weighted sum (not an opaque aggregate) so the optimizer can see which component is weak.

The metric is **only** invoked by the DSPy optimizer against the **frozen** eval set. It is never invoked against live traffic.

---

## 8. Optimizer progression

| Stage | Optimizer | When to graduate |
|---|---|---|
| Initial | `BootstrapFewShot` | After first 100 successful `Episode` rows |
| Mid | `MIPRO` (v2) | After BootstrapFewShot plateau on the eval set |
| Advanced | `GEPA` (reflective evolution) | After MIPRO plateau; needs careful budget |

`GEPA` is the most powerful but also the most expensive. Use it only when the simpler optimizers plateau.

---

## 9. Optimization loop

```python
async def optimize_tutor_program():
    train_set = load_optimization_examples(limit=200)
    eval_set = load_frozen_eval_set()                  # immutable

    base = load_active_prompt_version()
    candidate = AdaptiveTutor()
    candidate.load_prompt(base.body)

    optimizer = dspy.MIPRO(
        metric=tutor_metric,
        auto="medium",
        num_threads=4,
    )

    optimized = optimizer.compile(
        candidate,
        trainset=train_set,
        valset=eval_set,
    )

    base_metrics = await run_benchmark(base.body, eval_set)
    candidate_metrics = await run_benchmark(optimized.dump_state(), eval_set)

    await api_post(
        "/optimization/runs",
        {
            "basePromptVersionId": base.id,
            "candidateJson": optimized.dump_state(),
            "baseMetricsJson": base_metrics,
            "candidateMetricsJson": candidate_metrics,
            "decision": "PENDING",
        },
    )
```

The `ai-api` writes to `api` via HTTP. The candidate is **not** deployed automatically.

---

## 10. The acceptance gate

[`docs/02-architecture/target-state.md` §4.7](../02-architecture/target-state.md#47-evaluation-framework) is the source of truth. Component metrics are exposed individually. A candidate is accepted iff:

```
correctness         >= baseline
grounding           >= baseline
pedagogy            >= baseline
personalization      >= baseline
hallucination_rate  <= baseline × 1.05
p95_latency         <= baseline × 1.10
cost_per_1k         <= baseline × 1.20
```

No opaque aggregate.

---

## 11. Human approval gate

A candidate is `PENDING` after the offline run. A human operator reviews via admin endpoint `POST /admin/optimization-runs/:id/approve` (or `/:id/reject`). Only on approval does the candidate move to canary.

This is enforced at the DB level: `OptimizationRun.decidedBy` must be set to a human principal. The optimizer worker cannot set this column.

---

## 12. Canary rollout

Once approved, the candidate is deployed to 5% of traffic via the `PromptVersion` registry + traffic splitter (see [`docs/03-plans/self-improving-llm.md` §Layer 5](./self-improving-llm.md#layer-5--online-canary--auto-rollback)). Real-time metrics monitored. Auto-rollback if regression > 10% in 1 hour. Manual promotion to 100% after stable.

---

## 13. What DSPy is NOT used for

- **System policy** and **educational policy**: never optimized. These are institutional constraints.
- **Adaptive policy parameters**: a separate optimization problem (policy tuner, not DSPy).
- **Learner model**: deterministic Elo-like; not optimized.
- **Memory extraction policy**: rule-based, not optimized.

DSPy optimizes **only** the tutor prompt template.

---

## 14. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-DSP-01 | DSPy module compiles; runs against 10 sample episodes |
| AC-DSP-02 | First `BootstrapFewShot` run improves `overall_score` by ≥ 5% vs baseline on the eval set |
| AC-DSP-03 | Optimizer cannot write to `EvaluationDataset.isFrozen = true` rows |
| AC-DSP-04 | Every `OptimizationRun` row has `decidedBy` set before deployment |
| AC-DSP-05 | At least one full loop: failing episodes → candidate → eval → gate → canary → promoted OR rejected |

---

## 15. Trade-offs

| Choice | Alternative | Why this |
|---|---|---|
| DSPy `ChainOfThought` | Raw prompt | Type safety + versionability. |
| `BootstrapFewShot` first | GEPA first | BootstrapFewShot is cheaper and more stable on small datasets. |
| Frozen benchmark separate from training | Same dataset | Prevents overfitting. Standard practice. |
| Human approval on every promotion | Auto-promote | Required by master prompt §1.4. |
| DSPy for prompt only | DSPy for policy too | The policy is deterministic; DSPy is overkill there. |

---

## 16. Open questions

| ID | Question | Decision owner |
|---|---|---|
| Q-04 | Optimization cadence: nightly vs weekly? | ops |
| Q-06 | Optimizer order: BootstrapFewShot → MIPRO → GEPA? | ml-lead |
| Q-13 | Initial optimization dataset size: 50 / 200 / 500 examples? | ml-lead |
| Q-14 | Should we run daily or weekly DSPy optimization cycles initially? | ops |