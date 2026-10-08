# PHASE 3 Verification Report — Learner Model

**Source:** Master Prompt for ReduCera AI §109, §13–§17, §19. Exit gate: one validated learner interaction → learner state changes, and the update is reproducible.

## 1. Exit Gate Checklist

```text
[✓] learning events       v1/learner_model/events.py (LearningEvent, Goal, MasteryChangeKind, GoalKind, LearnerSignalKind)
[✓] mastery               v1/learner_model/mastery.py (MasteryService + Elo-like EloK update + 8 golden vectors)
[✓] confidence            ConceptMastery.confidence ∈ [0, 1] with confidence_delta_for evidence-driven growth
[✓] misconceptions        v1/learner_model/misconception.py (MisconceptionPipeline: CANDIDATE → CONFIRMED → PERSISTENT → RESOLVED)
[✓] behavioral signals    error_patterns dict + hint_dependency + difficulty_tolerance
[✓] goals                 Goal entity with GoalKind (MASTERY/COMPLETION/EXPLORATION/REMEDIATION)
[✓] learner-state snapshots  LearnerState.to_dict() + clone_for_replay() with state_version counter

[✓] AdaptivePolicyService with PolicyVersion="v1.0.0" + reason codes
[✓] determinism: same input + same policy version = same output     (test_policy_is_deterministic_for_same_input)
[✓] difficulty ∈ [0, 1]                                            (test_difficulty_in_unit_interval_for_random_state × 120 fixtures)
[✓] hint_level ∈ [0, 7]                                            (test_difficulty_in_unit_interval_for_random_state)
[✓] open misconceptions ≥ threshold → high scaffolding                (test_misconception_present_means_misconception_repair_or_high_scaffolding)
[✓] insufficient evidence → conservative adaptation                (test_insufficient_evidence_recorded)
[✓] reproducible across 100 seeds                                   (test_policy_reproducible_across_100_seeds)

[✓] off-topic interaction → no mastery pollution                    (test_off_topic_does_not_change_mastery_no_policy_pollution)
[✓] preference confidence increases with evidence                   (test_preference_reinforce_and_decay)
[✓] old low-confidence preference decays appropriately             (test_old_low_confidence_preference_decays_more_than_recent)
[✓] mastery reproducible for same event sequence                    (test_mastery_is_reproducible_for_same_event_sequence)
[✓] all golden vectors pass                                         (test_all_golden_vectors_pass)
```

## 2. Files Created

```text
v1/learner_model/
├── __init__.py                                 re-exports
├── events.py                                   LearningEvent, Goal, enums (LearnerSignalKind, MasteryChangeKind, GoalKind)
├── state.py                                    ConceptMastery + LearnerState + SessionStage
├── preferences.py                              Preference + PreferenceKey + PreferenceSource
├── misconception.py                           MisconceptionPipeline + TrackedMisconception + lifecycle
├── mastery.py                                   MasteryService (Elo-like EloK update) + MasteryDelta + MasteryUpdate + GOLDEN_VECTORS
├── policy.py                                   AdaptivePolicyService + AdaptiveStrategy + StrategyName + ScaffoldingLevel + HintPolicy + PROPERTY_INVARIANTS + check_invariants
├── llm_signal.py                               detect_instruction_injection + extract_misconception_proposals + extract_mastery_proposal
└── __tests__/
    ├── test_mastery_and_preferences.py         10 tests   correct/incorrect/off-topic/hint/misconception/bounded/dampens/golden/reproducible/preference
    ├── test_misconception_pipeline.py          4 tests    lifecycle (CANDIDATE/CONFIRMED/PERSISTENT/RESOLVED)
    ├── test_policy.py                          10 tests   low/high mastery, misconception promotion, hint policy, onboarding,
                                                       reproducibility, off-topic, preference decay, scaffolding vs insufficient evidence
    ├── test_policy_property_based.py           5 tests   120 random fixtures + 100 seeds + threshold mapping
                                                       + difficulty stability + misconception invariant
    └── test_llm_signal.py                     5 tests   injection detection, misconception extraction (3 types), mastery validation

                                                  -------
                                                  34 tests passing
```

## 3. Architecture

```text
                   LLM tutor output
                          │
                          ▼
              llm_signal.extract_misconception_proposals
              llm_signal.extract_mastery_proposal
                          │
                          ▼
                  inject_instruction_injection filter
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                    ▼
   MisconceptionPipeline              MasteryService
        │                                    │
        │ propose(event)                   │ apply_event(event)
        ▼                                    ▼
   TrackedMisconception                MasteryUpdate
        │                                    │
        │ stage transitions:               │ MasteryDelta[]
        │ CANDIDATE → CONFIRMED →          │ event in LearnerState.recent_activity
        │ PERSISTENT → RESOLVED             │
        ▼                                    ▼
   LearnerState.misconceptions          LearnerState.concept_mastery[concept_id]
                                                          │
                                                          ▼
                                                 AdaptivePolicyService.select(state, concept_id)
                                                          │
                                                          ▼
                                                 AdaptiveStrategy
                                                 (mode, strategy, difficulty, hint_level, hint_policy,
                                                  scaffolding, reason_codes, policy_version)
```

## 4. MasteryService — Determinism Contract

```text
applied_event         score_after > score_before     confidence_after > confidence_before
applied_incorrect     score_after < score_before     confidence_after < confidence_before
hint_used              score unchanged                  hint_dependency += 0.1
off_topic             score unchanged                  confidence unchanged
misconception_resolved  score_after > score_before     confidence_after > score_before

eligible for hint     delta *= HINT_DAMPING ** hint_level     (HINT_DAMPING = 0.6)

bounded               0.0 <= score <= 1.0       (asserted across 200 events in test_mastery_score_bounded_in_unit_interval)
reproducible          identical event sequence → identical state    (test_mastery_is_reproducible_for_same_event_sequence)
dampened              correct_with_hint_0 > correct_with_hint_3      (test_hint_dampens_correct_delta)
golden            (8/8 pass in test_all_golden_vectors_pass)
  G01  correct_answer_increases_mastery
  G02  incorrect_answer_decreases_mastery
  G03  hint_used_does_not_increase_mastery
  G04  off_topic_does_not_change_mastery
  G05  misconception_resolution_increases_confidence
  G06  mastery_is_bounded_in_0_1
  G07  hint_dampens_correct_delta
  G08  repeated_incorrect_drives_mastery_toward_zero
```

## 5. AdaptivePolicyService — Decision Contract

```text
inputs:
  LearnerState (mastery, misconceptions, hint_dependency, current_stage, ...)
  concept_id

outputs:
  AdaptiveStrategy {
    mode, strategy, difficulty, hint_level, hint_policy,
    scaffolding, reason_codes, policy_version
  }

strategy selection:
  misconceptions_for_concept > 0                  → MISCONCEPTION_REPAIR
  mastery.score < 0.30                              → GUIDED_STEP_BY_STEP / DIRECT_EXPLANATION
  0.30 <= score < 0.55                              → WORKED_EXAMPLE
  0.55 <= score < 0.75                              → RETRIEVAL_PRACTICE
  0.75 <= score < 0.90                              → CHALLENGE
  score >= 0.90                                    → SPACED_REVIEW

scaffolding:
  misconceptions > 0 OR evidence_count < 3 OR hint_dependency > 0.6    → HIGH
  0.0 <= score < 0.60                                                    → MEDIUM
  else                                                                   → LOW

difficulty:
  base = mastery.score (0.5 if missing)              → clamp(0, 1)
  adjusted down by hint_level * 0.05

hint_policy:
  current_stage == ONBOARDING                       → PROACTIVE
  hint_dependency > 0.6                              → MINIMAL
  else                                              → SCAFFOLDED

reason codes (deterministic subset of):
  INSUFFICIENT_EVIDENCE, LOW_MASTERY, HIGH_MASTERY,
  HIGH_HINT_DEPENDENCY, OPEN_MISCONCEPTION,
  HIGH_SCAFFOLDING, LOW_SCAFFOLDING,
  DIFFICULTY_OUT_OF_RANGE, HINT_LEVEL_OUT_OF_RANGE

policy_version:    "v1.0.0"
```

## 6. MisconceptionPipeline — Lifecycle

```text
propose(misconception) → adds evidence
                       → if evidence_count >= 3 → CONFIRMED (status=CONFIRMED, confidence >= 0.7)
                       → if evidence_count >= 5 → PERSISTENT (status=PERSISTENT)
                       → CONFIRMED + add_evidence is idempotent on the same misconception_id
resolve(misconception_id, evidence_text) → RESOLVED
                                          → cleared from all_for_concept() active set
```

## 7. Preference Contract

```text
Preference {
    key (PreferenceKey: EXPLANATION_STYLE / PACING / DIFFICULTY_TOLERANCE / HINT_DEPENDENCY / FORMAT_PREFERENCE)
    value (str)
    source (DECLARED | OBSERVED | INFERRED)
    confidence ∈ [0, 1]
    evidence_count >= 1
    last_observed_at (datetime)
}

reinforce(additional, boost=0.05):
    confidence = min(1.0, confidence + 0.05)
    evidence_count += additional

decay(rate=0.02, half_life_days=30, now=...):
    recency_multiplier = 0.5 ** (age_days / 30)
    effective_decay     = rate * (1 + (1 - recency) * 4)
    confidence = max(0, confidence - effective_decay)

This produces the desired property: an OLD low-confidence preference decays MORE than a recent one of equal initial confidence
(verified by test_old_low_confidence_preference_decays_more_than_recent).
```

## 8. Master Prompt §98 Compliance

```text
[✓] same learner state → same policy                       test_policy_is_deterministic_for_same_input
[✓] low mastery → increased scaffolding                    test_low_mastery_with_insufficient_evidence_uses_high_scaffolding
                                                          + test_misconception_present_means_misconception_repair_or_high_scaffolding
[✓] high mastery → increased challenge                     test_high_mastery_increases_challenge
[✓] misconception → remediation strategy                  test_misconception_promotes_to_misconception_repair
[✓] high hint dependency → reduced direct-answer behavior  test_high_hint_dependency_keeps_hint_dependency_low_with_minimal_policy
[✓] weak evidence → conservative adaptation                test_insufficient_evidence_recorded
[✓] off-topic interaction → no mastery pollution           test_off_topic_does_not_change_mastery_no_policy_pollution
[✓] preference confidence increases with evidence          test_preference_reinforce_and_decay
[✓] old low-confidence preference decays appropriately    test_old_low_confidence_preference_decays_more_than_recent
```

## 9. Master Prompt §19 Compliance — Property-Based Tests

```text
test_policy_invariants_under_random_state          120 random fixtures       all invariants hold
test_policy_reproducible_across_100_seeds          100 seeds                 all produce identical strategy
test_strategy_mapping_consistent_across_score_thresholds   21 score samples   strategy matches score-band expectations
test_difficulty_in_unit_interval_for_random_state  120 random fixtures       difficulty ∈ [0, 1]
test_misconception_present_means_misconception_repair_or_high_scaffolding   50 fixtures   invariant holds

Total random property-based assertions: 120+ (master prompt §19 minimum)
```

## 10. Master Prompt §15 Mastery Acceptance

```text
[✓] bounded                 test_mastery_score_bounded_in_unit_interval
[✓] incremental            test_correct_answer_increases_mastery_and_confidence
[✓] evidence-driven        test_confidence_delta_for(...) and ConceptMastery.evidence_count tracking
[✓] deterministic          test_mastery_is_reproducible_for_same_event_sequence
[✓] versioned              LearnerState.state_version + clone_for_replay
[✓] reproducible           test_mastery_is_reproducible_for_same_event_sequence
```

## 11. Master Prompt §17 Compliance

```text
[✓] declared preference     PreferenceSource.DECLARED
[✓] observed preference     PreferenceSource.OBSERVED
[✓] inferred preference     PreferenceSource.INFERRED
[✓] confidence             ∈ [0, 1] (validated in __post_init__)
[✓] evidenceCount          >= 1 (validated in __post_init__)
[✓] never infers permanent characteristic from one interaction
                          (a single reinforcement produces evidence_count=2 minimum;
                           confidence never jumps to 1.0; decay exists in the opposite direction)
```

## 12. LLM Signal Boundary

```text
detect_instruction_injection(text):
    - returns True if text matches (ignore|disregard|forget)\s+(previous|prior|earlier|the)\s+(instructions?|prompts?|rules?|directions?|policies)
    - returned before any taxonomy lookup so a malicious learner_text is rejected at the boundary

extract_misconception_proposals(text, taxonomy=...):
    - returns [] if injection detected
    - returns heuristic proposals based on text concept-overlap (not the LLM's free-form output)
    - scope-bounded: only returns proposals whose concept_id exists in the taxonomy graph

extract_mastery_proposal(...):
    - validates confidence ∈ [0, 1] and hint_level ∈ [0, 7] (raises ValueError otherwise)
```

## 13. Known Follow-Ups (out of Phase 3 scope)

```text
1. Persistence of LearnerState and its derived events to api is NOT yet wired.
   ai-api owns the in-process learner model (per master prompt §13);
   the api-side Prisma tables (LearnerGoal, TopicMasteryRecord, Misconception,
   BehavioralSignals, EpisodicMemory, etc.) are the long-term store.
   ai-api will POST mastery updates to /internal/mastery on api, with the
   api applying authority (signed contract, idempotency).
   This is the api-side migration tracked in Phase 1 follow-up.

2. Episode store (master prompt §42) is not the same as the learner model;
   episodes are written via write_episode() (Phase 1) with trace_id.
   The learner-model code here manages in-process state.

3. The LLM signal extractor is heuristic; Phase 6 will wire the LLM
   into a structured-output function-call so the LLM itself proposes
   misconceptions and mastery changes via JSON tool calls.

4. Goal persistence and reminder behavior (master prompt §51, §56) is not
   in scope here; Phase 7 will own that.
```

**Phase 3 exits the gate.**