from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from v1.memory.decay import (
    HALF_LIFE_DAYS,
    RetrievalCandidate,
    rank_candidates,
    recency_multiplier,
    retention_score,
    retrieval_score,
    should_retain,
    usage_boost,
)


def test_recency_multiplier_floor_for_extremely_old():
    assert recency_multiplier(datetime.now(timezone.utc) - timedelta(days=3650)) >= 0.05
    assert recency_multiplier(datetime.now(timezone.utc) - timedelta(days=100000)) >= 0.05


def test_retrieval_score_in_unit_interval_for_valid_inputs():
    now = datetime.now(timezone.utc)
    rng = random.Random(123456)
    for _ in range(500):
        c = RetrievalCandidate(
            item_id=f"c-{rng.randint(0, 9999)}",
            relevance=rng.uniform(0, 1),
            confidence=rng.uniform(0, 1),
            scope_match=rng.uniform(0, 1),
            salience=rng.uniform(0, 1),
            last_observed_at=now - timedelta(days=rng.uniform(0, 365)),
        )
        score = retrieval_score(c)
        assert 0.0 <= score <= 1.0


def test_ranking_invariant_under_permutation():
    rng = random.Random(987)
    candidates = [
        RetrievalCandidate(
            item_id=str(i),
            relevance=rng.uniform(0, 1),
            confidence=rng.uniform(0, 1),
            scope_match=rng.uniform(0, 1),
            salience=rng.uniform(0, 1),
            last_observed_at=datetime.now(timezone.utc) - timedelta(days=rng.uniform(0, 200)),
        )
        for i in range(50)
    ]
    rank_a = [c.item_id for c in rank_candidates(candidates)]
    rank_b = [c.item_id for c in rank_candidates(list(reversed(candidates)))]
    assert rank_a == rank_b


def test_recency_decay_halves_at_half_life():
    now = datetime.now(timezone.utc)
    fresh = recency_multiplier(now, now=now)
    half_life_old = recency_multiplier(now - timedelta(days=HALF_LIFE_DAYS), now=now)
    assert 0.45 <= half_life_old <= 0.55
    assert fresh == 1.0


def test_higher_confidence_increases_retention_for_same_age():
    age_days = 30
    low = retention_score(confidence=0.3, salience=0.5, age_days=age_days)
    high = retention_score(confidence=0.9, salience=0.5, age_days=age_days)
    assert high > low


def test_should_retain_threshold_boundary():
    assert should_retain(confidence=0.9, salience=0.9, age_days=1)
    assert not should_retain(confidence=0.1, salience=0.1, age_days=60)
    boundary = retention_score(confidence=0.5, salience=0.5, age_days=HALF_LIFE_DAYS)
    assert boundary == 0.5 * 0.5 * 0.5


def test_usage_boost_saturates():
    base = 0.5
    assert usage_boost(base, 0) == 0.5
    boosted = usage_boost(base, 100, ceiling=0.9)
    assert boosted <= 0.9
    assert boosted >= 0.5


def test_recency_is_monotone_decreasing_across_random_ages():
    now = datetime.now(timezone.utc)
    rng = random.Random(42)
    ages = sorted([rng.uniform(0, 1000) for _ in range(50)])
    multipliers = [recency_multiplier(now - timedelta(days=a), now=now) for a in ages]
    for i in range(1, len(multipliers)):
        assert multipliers[i] <= multipliers[i - 1]