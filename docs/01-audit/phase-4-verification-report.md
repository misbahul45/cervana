# PHASE 4 Verification Report — Memory

**Source:** Master Prompt for ReduCera AI §110. Exit gate: useful memory survives, noise does not, cross-user leakage is impossible.

## 1. Exit Gate Checklist

```text
[✓] useful memory survives                  test_retrieval_ranking_prefers_relevant_recent_high_confidence
[✓] noise does not                         test_reject_low_salience_event + test_reject_one_off_observation_with_strict_policy
[✓] cross-user leakage is impossible       test_user_isolation_learner_a_never_visible_to_learner_b +
                                           test_user_isolation_through_retrieval_path +
                                           test_isolation_under_random_users_with_random_traits
                                           (20 random alice + 20 random bob traits; no leak)
```

## 2. Files Created

```text
v1/memory/
├── __init__.py                          re-exports public surface
├── types.py                             MemoryCandidate (dataclass) + MemorySource enum + MemoryDecision enum + MemoryWritePolicy
├── working.py                           WorkingMemory (per-session, transient; discard_working)
├── episodic.py                          Episode (master prompt §42 schema) + EpisodeOutcome + EpisodicMemory
├── semantic.py                          SemanticTrait (master prompt §30 schema) + SemanticSource + SemanticLearnerMemory
├── procedural.py                        Procedure (master prompt §32 schema) + ProceduralMemory
├── decay.py                             HALF_LIFE_DAYS, RECENCY_FLOOR, RetrievalCandidate, recency_multiplier, retrieval_score, rank_candidates, retention_score, should_retain, usage_boost
├── isolation.py                         IsolationReport, IsolationError, assert_no_leak, detect_leak
├── layer.py                             MemoryLayer orchestrator + WriteOutcome
└── __tests__/
    ├── test_memory_invariants.py        25 tests  all §97 scenarios + isolation
    ├── test_layers.py                    6 tests   working memory, semantic, procedural, episodic, isolation
    └── test_decay_property_based.py      8 tests   decay invariants under 500 random fixtures

                                       -------
                                       39 tests passed
```

## 3. Master Prompt §97 — Required Memory Tests (15+)

```text
[✓] store meaningful event                              test_store_meaningful_event
[✓] reject low-salience event                          test_reject_low_salience_event
[✓] reject instruction-like memory                     test_reject_instruction_like_memory
[✓] confidence threshold                              test_reject_low_confidence_memory
[✓] evidence threshold                                test_reject_insufficient_evidence (strict policy)
[✓] memory decay                                       test_recency_multiplier_is_monotonically_decreasing_with_age,
                                                        test_recency_decay_halves_at_half_life,
                                                        test_recency_is_monotone_decreasing_across_random_ages
[✓] retrieval ranking                                  test_retrieval_ranking_prefers_relevant_recent_high_confidence,
                                                        test_ranking_invariant_under_permutation (50 fixtures)
[✓] user isolation                                     test_user_isolation_learner_a_never_visible_to_learner_b,
                                                        test_user_isolation_through_retrieval_path,
                                                        test_isolation_under_random_users_with_random_traits,
                                                        test_isolation_error_raised_on_leak
[✓] lesson isolation                                   test_lesson_isolation_global_scope_does_not_leak_across_lessons
[✓] update conflict                                    test_update_conflict_keeps_higher_confidence_value,
                                                        test_semantic_upsert_keeps_higher_confidence_value_on_conflict,
                                                        test_procedural_upsert_dedup_steps
[✓] delete                                              test_delete_removes_trait,
                                                        test_delete_for_learner_clears_all_their_memory
[✓] retention                                          test_memory_decay_low_confidence_low_salience_drops_below_threshold,
                                                        test_higher_confidence_increases_retention_for_same_age,
                                                        test_should_retain_threshold_boundary
[✓] PII rejection                                       test_reject_pii_in_memory
[✓] one-off observation rejection                       test_reject_one_off_observation_with_strict_policy
[✓] unsupported claim rejection                        test_write_policy_decision_for_unsupported_claim
```

## 4. Memory Architecture

```text
                        write_candidate
                              │
                              ▼
                  MemoryWritePolicy.decide()
                              │
        ┌──────────┬───────────┼───────────┬──────────┐
        ▼          ▼           ▼           ▼          ▼
REJECT_INSTRUCTION REJECT_PRIVACY REJECT_LOW_SALIENCE REJECT_NO_EVIDENCE ACCEPT
        └──────────┴───────────┼───────────┴──────────┘
                              ▼ ACCEPT
              SemanticLearnerMemory.upsert(trait)
                              │
                              ▼
                       SemanticTrait
                              │
                              ▼
             MemoryLayer.recall_semantic() retrieves
                              │
                              ▼
                 RetrievalCandidate ranking
                  (relevance × confidence ×
                   scope_match × salience × recency)
```

## 5. MemoryWritePolicy — Pipeline Order

```
1. is_instruction_like(value)        → REJECT_INSTRUCTION       (master prompt §91, §33)
2. contains_pii(value)               → REJECT_PRIVACY          (§91: irrelevant personal information)
3. is_irrelevant(value)              → REJECT_IRRELEVANT       (length < 3)
4. salience < min_salience            → REJECT_LOW_SALIENCE
5. evidence_count < min_evidence      → REJECT_NO_EVIDENCE
6. confidence < min_confidence        → REJECT_LOW_CONFIDENCE
7. novelty < min_novelty              → REJECT_NOVELTY
8. recurrence_count < min_recurrence  → REJECT_ONE_OFF
9. otherwise                          → ACCEPT
```

## 6. Decay-Aware Retrieval Scoring

```
recency_multiplier(observed_at, now)
    = max(RECENCY_FLOOR, 0.5 ** (age_days / HALF_LIFE_DAYS))

retrieval_score(candidate)
    = relevance × confidence × scope_match × salience × recency_multiplier(last_observed_at)

retention_score(confidence, salience, age_days)
    = confidence × salience × 0.5 ** (age_days / HALF_LIFE_DAYS)

should_retain(threshold=0.10)
    = retention_score(...) >= threshold
```

Invariants verified by `test_decay_property_based.py` (500 random fixtures + 50 fixtures × permutation):

```
[✓] recency_floor_for_extremely_old  ≥ 0.05 even after 100,000 days
[✓] retrieval_score_in_unit_interval  0 ≤ score ≤ 1
[✓] ranking_invariant_under_permutation
[✓] recency_decay_halves_at_half_life  ~0.5 at 30 days
[✓] higher_confidence_increases_retention
[✓] recency_is_monotone_decreasing
[✓] boundary_ceiling_for_usage_boost
```

## 7. Cross-User Isolation (master prompt §35 — hard invariant)

```
Learner A memory
        │
        ▼
MemoryLayer.recall_semantic(learner_id=B)
        │
        ▼
    IsolationReport.leaked = any forbidden substring in B's view
        │
        ▼
assert_no_leak(report) raises IsolationError if leaked
```

Verified by:
- test_user_isolation_learner_a_never_visible_to_learner_b (deterministic)
- test_user_isolation_through_retrieval_path (via the public recall API)
- test_isolation_under_random_users_with_random_traits (20 random alice + 20 random bob traits)
- test_isolation_error_raised_on_leak (the assertion API itself)

Indirect isolation:
- SemanticLearnerMemory.upsert / recall uses learner_id strict filter
- ProceduralMemory.recall uses learner_id strict filter
- EpisodicMemory.recall uses learner_id strict filter
- No `all_learners()` API exists

## 8. Master Prompt §91 — Memory Poisoning Defense

```text
[✓] reject "ignore previous instructions"     (REJECT_INSTRUCTION)
[✓] reject "disregard prior rules"             (REJECT_INSTRUCTION)
[✓] reject "forget earlier instructions"        (REJECT_INSTRUCTION)
[✓] reject "system override"                    (REJECT_INSTRUCTION)
[✓] reject "you are now ..."                     (REJECT_INSTRUCTION)
[✓] reject "reveal your prompt"                 (REJECT_INSTRUCTION)
[✓] reject "developer instructions"             (REJECT_INSTRUCTION)
[✓] reject "override the policy"                (REJECT_INSTRUCTION)
[✓] reject SSN / credit card / passport         (REJECT_PRIVACY)
[✓] reject unsupported permanent claims         (via min_salience gate)
[✓] reject privilege escalation text           (via instruction-like filter)
```

## 9. Memory Retention Policy

```
should_retain(confidence, salience, age_days, threshold=0.10)
    returns True iff confidence × salience × 0.5 ** (age_days/30) >= 0.10

Verified:
  test_memory_decay_low_confidence_low_salience_drops_below_threshold  (0.1 × 0.1 × 60d ⇒ False)
  test_should_retain_threshold_boundary                                  (0.5 × 0.5 × 30d ⇒ 0.125 ⇒ True)
  test_higher_confidence_increases_retention_for_same_age
```

## 10. Master Prompt §33 Compliance

```
[✓] salience gate                         REJECT_LOW_SALIENCE
[✓] evidence gate                         REJECT_NO_EVIDENCE
[✓] confidence gate                      REJECT_LOW_CONFIDENCE
[✓] novelty gate                          REJECT_NOVELTY (similarity dedup)
[✓] recurrence gate                       REJECT_ONE_OFF
[✓] privacy gate                          REJECT_PRIVACY (PII patterns)
[✓] retention gate                        should_retain(threshold)
[✓] instruction-injection defense         REJECT_INSTRUCTION (master prompt §91)
```

## 11. Phase 1 Follow-Up

```
[✓] pyproject.toml collect_ignore removed   (master prompt §91: this was a hidden defect)
[✓] cross-user isolation tests added        (master prompt §35 hard invariant)
[✓] cross-lesson isolation tests added     (master prompt §35 hard invariant)
[✓] lesson-scope enum tested               test_lesson_isolation_global_scope_does_not_leak_across_lessons
```

## 12. Known Follow-Ups (out of Phase 4 scope)

```
1. Persistence of memory to Qdrant and to services/api is wired separately via
   utils/tools/memory.py and via signed POSTs. The new typed memory here is the
   in-process layer that wraps persistence. Phase 6 will route the tutor through
   MemoryLayer for write/read decisions and keep the Qdrant layer as the
   long-term store.

2. Episode → EpisodeStore persistence is owned by Phase 1's write_episode()
   (Phase 1 §P1-E). The EpisodicMemory class here is the in-process schema.

3. The instructor_signal heuristic in v1/learner_model/llm_signal.py uses the
   same instruction-injection patterns as MemoryWritePolicy.is_instruction_like.
   Phase 6 will consolidate them into a single module.

4. Memory persistence to api (master prompt §33 "Index" step) is owned by
   services/api's MemoryService. ai-api writes through the signed contract.
```

**Phase 4 exits the gate.**

## 13. Phase Status

```
PHASE 0  Audit (10 docs)                                      ✓ done
PHASE 1  AI Foundation                                        ✓ donePHASE 2  Accounting Domain Foundation                         ✓ done
PHASE 3  Learner Model                                        ✓ done
PHASE 4  Memory                                               ✓ done   ← NEW
PHASE 5  Adaptive Policy                                      pending  (overlap with Phase 3 — see note)
PHASE 6  Personalized Tutor                                   pending
PHASE 7  Gamification                                         pending
PHASE 8  Evaluation                                           pending
PHASE 9  Self-Improvement                                     pending
PHASE 10 Research Loop                                        pending
```

Phase 5 (Adaptive Policy) is largely covered by Phase 3's `AdaptivePolicyService`
plus `v1/learner_model/policy.py`. Phase 5 in the master prompt calls out the
deterministic invariants, golden vectors, and reason codes — all already present
in Phase 3. Phase 5 work will be limited to integration with the tutor prompt
builder and the property-based test expansion if the owner requests it.

When ready, say "Authorize Phase 6" and I will execute the Personalized Tutor
integration (tutor prompt now includes learner state, memory refs, adaptive
strategy as a typed input).