from __future__ import annotations

import itertools
import random
from typing import List

from v1.domain.misconception import Misconception, MisconceptionType
from v1.learner_model import (
    AdaptivePolicyService,
    LearnerState,
    SessionStage,
    check_invariants,
)


def _random_state(rng: random.Random, *, concept: str = "c1") -> LearnerState:
    state = LearnerState(learner_id="pbt")
    state.current_stage = rng.choice(list(SessionStage))
    state.hint_dependency = rng.uniform(0.0, 1.0)
    state.difficulty_tolerance = rng.uniform(0.0, 1.0)
    mastery = state.get_mastery(concept)
    mastery.score = rng.choice([0.0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.85, 0.95, 1.0])
    mastery.confidence = rng.choice([0.0, 0.2, 0.4, 0.5, 0.7, 0.9, 1.0])
    mastery.evidence_count = rng.randint(0, 12)
    mc = rng.randint(0, 3)
    for i in range(mc):
        state.misconceptions.propose(
            Misconception(
                misconception_id=f"m{i}-{rng.randint(0, 9999)}",
                concept_id=concept,
                type=MisconceptionType.OTHER,
            )
        )
    return state


def test_policy_invariants_under_random_state():
    rng = random.Random(20261005)
    policy = AdaptivePolicyService()
    fixtures = [_random_state(rng) for _ in range(120)]
    failures = []
    for idx, state in enumerate(fixtures):
        strategy = policy.select(state, "c1")
        broken = check_invariants(strategy)
        if broken:
            failures.append((idx, broken, state.to_dict()))
    assert failures == [], failures[:3]


def test_policy_reproducible_across_100_seeds():
    policy = AdaptivePolicyService()
    for seed in range(100):
        rng = random.Random(seed)
        state = _random_state(rng)
        s1 = policy.select(state, "c1")
        s2 = policy.select(state, "c1")
        assert s1.to_dict() == s2.to_dict()


def test_strategy_mapping_consistent_across_score_thresholds():
    policy = AdaptivePolicyService()
    samples = [round(x * 0.05, 2) for x in range(0, 21)]
    for score in samples:
        state = LearnerState(learner_id="threshold")
        mastery = state.get_mastery("c1")
        mastery.score = score
        mastery.confidence = score
        mastery.evidence_count = 5
        strategy = policy.select(state, "c1")
        if score < 0.3:
            assert strategy.strategy.value in {"GUIDED_STEP_BY_STEP", "DIRECT_EXPLANATION"}
        elif score < 0.55:
            assert strategy.strategy.value in {"WORKED_EXAMPLE", "GUIDED_STEP_BY_STEP", "DIRECT_EXPLANATION"}
        elif score < 0.75:
            assert strategy.strategy.value in {"RETRIEVAL_PRACTICE", "WORKED_EXAMPLE"}
        elif score < 0.9:
            assert strategy.strategy.value in {"CHALLENGE", "RETRIEVAL_PRACTICE"}
        else:
            assert strategy.strategy.value in {"SPACED_REVIEW", "CHALLENGE"}


def test_difficulty_in_unit_interval_for_random_state():
    policy = AdaptivePolicyService()
    rng = random.Random(424242)
    for _ in range(120):
        state = _random_state(rng)
        strategy = policy.select(state, "c1")
        assert 0.0 <= strategy.difficulty <= 1.0
        assert 0 <= strategy.hint_level <= 7


def test_misconception_present_means_misconception_repair_or_high_scaffolding():
    policy = AdaptivePolicyService()
    rng = random.Random(777)
    for _ in range(50):
        state = _random_state(rng)
        for i in range(3):
            state.misconceptions.propose(
                Misconception(
                    misconception_id=f"ms{i}-{rng.randint(0, 9999)}",
                    concept_id="c1",
                    type=MisconceptionType.OTHER,
                )
            )
        strategy = policy.select(state, "c1")
        if state.misconceptions.all_for_concept("c1"):
            assert strategy.scaffolding.value == "HIGH" or strategy.strategy.value == "MISCONCEPTION_REPAIR"