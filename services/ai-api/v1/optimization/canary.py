from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any, Dict


@dataclass(frozen=True)
class CanaryDecision:
    candidate_id: str
    sample_size: int
    active_count: int
    candidate_count: int
    active_ratio: float
    candidate_ratio: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "candidateId": self.candidate_id,
            "sampleSize": self.sample_size,
            "activeCount": self.active_count,
            "candidateCount": self.candidate_count,
            "activeRatio": self.active_ratio,
            "candidateRatio": self.candidate_ratio,
        }


class CanarySplitter:
    """Master prompt §76.

    Default: 95% active / 5% candidate.
    """

    def __init__(
        self,
        *,
        candidate_ratio: float = 0.05,
        seed: int = 20261005,
    ) -> None:
        if not (0 <= candidate_ratio <= 1):
            raise ValueError("candidate_ratio must be in [0, 1]")
        self.candidate_ratio = candidate_ratio
        self.seed = seed

    def decide(self, candidate_id: str, *, sample_size: int, seed: int | None = None) -> CanaryDecision:
        if sample_size <= 0:
            raise ValueError("sample_size must be positive")
        rng = random.Random(seed if seed is not None else self.seed)
        candidate_count = 0
        for _ in range(sample_size):
            if rng.random() < self.candidate_ratio:
                candidate_count += 1
        active_count = sample_size - candidate_count
        return CanaryDecision(
            candidate_id=candidate_id,
            sample_size=sample_size,
            active_count=active_count,
            candidate_count=candidate_count,
            active_ratio=active_count / sample_size,
            candidate_ratio=candidate_count / sample_size,
        )


__all__ = ["CanaryDecision", "CanarySplitter"]