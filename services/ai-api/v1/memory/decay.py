from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from math import exp, log1p
from typing import List, Optional


HALF_LIFE_DAYS = 30.0
RECENCY_FLOOR = 0.05


@dataclass(frozen=True)
class RetrievalCandidate:
    item_id: str
    relevance: float
    confidence: float
    scope_match: float
    salience: float
    last_observed_at: datetime
    metadata: dict | None = None

    def to_dict(self) -> dict:
        return {
            "itemId": self.item_id,
            "relevance": self.relevance,
            "confidence": self.confidence,
            "scopeMatch": self.scope_match,
            "salience": self.salience,
            "lastObservedAt": self.last_observed_at.isoformat(),
        }


def recency_multiplier(observed_at: datetime, *, now: Optional[datetime] = None, half_life_days: float = HALF_LIFE_DAYS) -> float:
    reference_now = now or datetime.now(timezone.utc)
    age_seconds = max(0.0, (reference_now - observed_at).total_seconds())
    age_days = age_seconds / 86400.0
    if age_days < 0:
        return 1.0
    decay = 0.5 ** (age_days / half_life_days)
    return max(RECENCY_FLOOR, decay)


def retrieval_score(
    candidate: RetrievalCandidate,
    *,
    now: Optional[datetime] = None,
) -> float:
    if not (0 <= candidate.relevance <= 1):
        raise ValueError(f"relevance must be in [0, 1], got {candidate.relevance}")
    if not (0 <= candidate.confidence <= 1):
        raise ValueError(f"confidence must be in [0, 1], got {candidate.confidence}")
    if not (0 <= candidate.scope_match <= 1):
        raise ValueError(f"scope_match must be in [0, 1], got {candidate.scope_match}")
    if not (0 <= candidate.salience <= 1):
        raise ValueError(f"salience must be in [0, 1], got {candidate.salience}")
    recency = recency_multiplier(candidate.last_observed_at, now=now)
    score = (
        candidate.relevance
        * candidate.confidence
        * candidate.scope_match
        * candidate.salience
        * recency
    )
    return score


def rank_candidates(
    candidates: List[RetrievalCandidate],
    *,
    now: Optional[datetime] = None,
) -> List[RetrievalCandidate]:
    return sorted(candidates, key=lambda c: retrieval_score(c, now=now), reverse=True)


def retention_score(
    *,
    confidence: float,
    salience: float,
    age_days: float,
    half_life_days: float = HALF_LIFE_DAYS,
) -> float:
    if not (0 <= confidence <= 1):
        raise ValueError(f"confidence must be in [0, 1], got {confidence}")
    if not (0 <= salience <= 1):
        raise ValueError(f"salience must be in [0, 1], got {salience}")
    recency = 0.5 ** (age_days / half_life_days)
    return confidence * salience * recency


def should_retain(
    *,
    confidence: float,
    salience: float,
    age_days: float,
    threshold: float = 0.10,
    half_life_days: float = HALF_LIFE_DAYS,
) -> bool:
    return retention_score(
        confidence=confidence,
        salience=salience,
        age_days=age_days,
        half_life_days=half_life_days,
    ) >= threshold


def usage_boost(base: float, usage_count: int, ceiling: float = 0.9) -> float:
    if usage_count <= 0:
        return base
    boost = log1p(usage_count) / log1p(11)
    return min(ceiling, base + (ceiling - base) * boost / 5)


__all__ = [
    "HALF_LIFE_DAYS",
    "RECENCY_FLOOR",
    "RetrievalCandidate",
    "recency_multiplier",
    "retrieval_score",
    "rank_candidates",
    "retention_score",
    "should_retain",
    "usage_boost",
]