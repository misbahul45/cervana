# Learner State Model

> **Status**: `planned` · **Owner**: `ml-lead` · **Last reviewed**: `2026-09-30`
>
> Full learner state schema and the Elo-like mastery update formula.

---

## 1. Purpose

Define the learner state Cervana tracks and the algorithm that updates it. Mastery is computed deterministically — **never** declared by the LLM.

The full storage schema lives in [`docs/02-architecture/data-model.md`](../02-architecture/data-model.md). This document focuses on the **shape** of the state and the **update rules**.

---

## 2. Conceptual model

```text
LearnerState
├── Identity
│     learner_id, created_at, last_active_at
├── Goals
│     goal_id, topic_id, target_mastery, deadline, status
├── Curriculum
│     enrolled_topic_ids, current_topic_id, current_lesson_id, current_step_id
├── TopicMastery              (one row per (learner, topic))
│     topic_id, score 0..1, confidence 0..1, evidence_count, last_observed_at
├── StepMastery               (one row per (learner, step))
│     step_id, score 0..1, attempts, last_score, last_attempted_at
├── Misconceptions            (one row per (learner, concept_key))
│     concept_key, count, first_seen_at, last_seen_at, status
├── Preferences
│     explanation_style, problem_style, pace, hint_tolerance
├── BehavioralSignals
│     hints_per_question_avg, response_time_avg_sec, skip_rate, retry_rate
├── RecentLearningState
│     sessions_count, questions_answered, correct_rate, time_spent_sec (last 7 days)
├── HistoricalLearningState
│     lifetime_topics_completed, lifetime_correct_rate, retention_30d
├── Confidence
│     overall_uncertainty 0..1, last_calibrated_at
├── DifficultyProfile
│     current_difficulty 0..1, zone_of_proximal_development [lo, hi]
└── AdaptationHistory
      last_strategy, last_strategy_outcome, strategy_change_count
```

---

## 3. Mastery formula

### 3.1 Why Elo-like

Cervana has few observations per learner-skill (median ≤ 5 attempts per step). This rules out:

- **Bayesian Knowledge Tracing (BKT)**: needs ~30 observations per skill to stabilize priors.
- **Item Response Theory (IRT)**: needs calibrated item parameters from a calibration study.
- **Logistic mastery**: needs priors.

**Elo-like update** captures recent performance without over-weighting history, is computationally trivial, survives few-observation regimes, and is reproducible. When more data arrives, the system can graduate to BKT.

### 3.2 Update on each attempt

```text
expected_score = 1 / (1 + 10 ** ((opponent_difficulty - current_mastery) × 4))
score_delta    = K × (actual - expected_score)
K              = base_K × confidence_factor × streak_factor
actual         ∈ {0, 0.5, 1}                  # 1 = correct, 0.5 = partial, 0 = incorrect
base_K         = 32 (default)
confidence_factor = 1 / (1 + evidence_count × 0.05)
streak_factor     = 2 if recent_3_correct
                   0.5 if recent_3_incorrect
                   1 otherwise
opponent_difficulty = difficulty of the question asked (0..1)

new_mastery    = clamp(old_mastery + score_delta, 0, 1)
new_confidence = sigmoid(α + β × log(evidence_count + 1))
```

Defaults: `α = -3`, `β = 2.5`.

### 3.3 Edge cases

| Case | Behavior |
|---|---|
| Partial understanding | `actual = 0.5`. Free-text rubric grades give 0.5 if reasoning is correct but detail is wrong. |
| Repeated misconception | If `Misconceptions.count ≥ 3` on a concept, halve `K` for the next 3 attempts on that concept. Prevents stuck-mastery on a known gap. |
| Hint dependency | If `hint_used = true`, set `actual = 0` even if answer is correct (treats hint use as evidence of incomplete mastery). |
| Streak factor | If the last 3 attempts are all correct, `streak_factor = 2` (faster mastery gain); if all 3 incorrect, `streak_factor = 0.5` (resistance to over-penalizing). |
| Time decay | Each day without practice on a topic: `mastery ×= 0.99`. Configurable per topic. |
| Off-topic question | Skip mastery update entirely. Log to `LearningEvent`. |

### 3.4 Worked example

```
prior mastery    = 0.40
opponent diff    = 0.55
expected_score   = 1 / (1 + 10 ** ((0.55 - 0.40) × 4))
                 = 1 / (1 + 10 ** 0.6)
                 ≈ 0.20
actual           = 1  (correct)
evidence_count   = 4
confidence_factor = 1 / (1 + 4 × 0.05) = 0.833
streak_factor    = 1   (no streak)
K                = 32 × 0.833 × 1 = 26.7
score_delta      = 26.7 × (1 - 0.20) = 21.3
new_mastery      = clamp(0.40 + 0.213, 0, 1)   ← ÷ 100 to convert Elo units
                 = 0.613
```

The system stores scores in [0, 1], not Elo units. Internal computation uses Elo arithmetic and converts at the storage boundary.

### 3.5 Unit tests (golden vectors)

| Prior | Difficulty | Actual | Evidence | Streak | Expected `new_mastery` |
|---|---|---|---|---|---|
| 0.50 | 0.50 | 1.0 (correct) | 0 | – | ~0.78 |
| 0.50 | 0.50 | 0.0 (incorrect) | 0 | – | ~0.22 |
| 0.50 | 0.50 | 1.0 (correct) | 10 | – | ~0.55 (lower K from high evidence) |
| 0.50 | 0.50 | 1.0 (correct) | 0 | 3-streak | ~0.83 (faster gain) |
| 0.50 | 0.50 | 0.5 (partial) | 4 | – | ~0.40 |
| 0.50 | 0.50 | 1.0 (correct + hint) | 4 | – | ~0.43 (hint penalty) |
| 0.95 | 0.50 | 1.0 (correct) | 10 | – | ~0.97 |
| 0.05 | 0.50 | 0.0 (incorrect) | 10 | – | ~0.04 |

These are the **must-pass** unit tests in Phase 3.

---

## 4. Confidence calibration

`new_confidence = sigmoid(α + β × log(evidence_count + 1))`

| Evidence count | Confidence (with α=-3, β=2.5) |
|---|---|
| 0 | 0.047 |
| 1 | 0.099 |
| 3 | 0.184 |
| 5 | 0.243 |
| 10 | 0.331 |
| 30 | 0.557 |
| 100 | 0.817 |

Confidence crosses 0.5 at ~25 observations. Below that, recommendations should be conservative.

---

## 5. Misconception lifecycle

```
Misconception detected (LLM-confirmed or rule-based)
    ↓ count = 1, status = OPEN, first_seen_at = now
Repeated detection (≥ 2 more times)
    ↓ count = 3+, confidence = high
Interventions:
    - Scaffolding = "high" in adaptive policy
    - Next attempt's K-factor is halved for this concept
    - Hint budget increased
Resolution:
    - 5 consecutive correct answers on concept → status = RESOLVED
    - Or teacher override
Decay:
    - 30 days without detection → status = DECAYING
    - 90 days → status = ARCHIVED (still queryable)
```

---

## 6. Preference update policy

Preferences are inferred from repeated evidence, not from a single observation.

| Field | Min observations to update | Confidence after N |
|---|---|---|
| `explanation_style` | 3+ consistent reports | increases with evidence_count |
| `pace` | 5+ observations of completion time | – |
| `hint_tolerance` | 3+ hint interactions | – |

A single quiz hint usage does **not** update `hint_tolerance`. A pattern of usage does.

---

## 7. Behavior signal computation

Updated nightly by a Celery worker (`api` side):

```
hints_per_question_avg = sum(hint_used) / count(attempts) over 30d
response_time_avg_sec  = mean(time_to_answer_seconds) over 30d
skip_rate              = count(skipped) / count(present) over 30d
retry_rate             = count(re_attempts) / count(questions) over 30d
```

Updated only if at least 5 observations exist in the window. Otherwise the field is left at its prior value (or null if first-time).

---

## 8. DifficultyProfile (Zone of Proximal Development)

```
current_difficulty = weighted(
    0.7 × step_mastery.lastScore,
    0.3 × topic_mastery.score,
)
zone_of_proximal_development = [
    clamp(current_difficulty - 0.2, 0, 1),
    clamp(current_difficulty + 0.2, 0, 1),
]
```

Used by `AdaptivePolicyService` to choose `difficulty` and `scaffolding` in [`target-state.md` §4.4](../02-architecture/target-state.md#44-adaptive-policy).

---

## 9. Trade-offs

| Choice | Alternative | Why this |
|---|---|---|
| Elo-like update | BKT | BKT requires more data per skill; Cervana has few observations per skill. Graduate when N ≥ 30. |
| Confidence from `sigmoid(α + β log(N))` | 1 - 1/(N+1) | Logistic gives a smoother 0–1 curve; better calibrated for downstream thresholds. |
| Per-concept `Misconception` rows | String list in JSON | Allows counting, status transitions, and SQL aggregation. |
| 30/90-day decay | Hard delete | Decay supports "recovered from past" without losing history. |
| Hint use as mastery penalty | Ignore hint usage | Reward only true understanding; hints are scaffolding, not answers. |

---

## 10. Open questions

| ID | Question | Status |
|---|---|---|
| Q-01 | Elo-like vs BKT vs IRT vs logistic? | pending owner decision |
| Q-09 | Should `partial` (0.5) be reserved for free-text only, or also apply to numeric answers within tolerance? | pending — recommend: tolerance = ±0.05 for numeric, applied automatically |
| Q-10 | Should `current_difficulty` be a moving average or an exponential moving average? | pending — recommend: EMA with `α = 0.3` |

These resolve in Phase 3 (Learner Model).