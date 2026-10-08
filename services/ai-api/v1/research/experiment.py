from __future__ import annotations

import math
import random
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class ExperimentArm(str, Enum):
    A_STATIC_TUTOR = "A_STATIC_TUTOR"
    B_LEARNER_MODEL = "B_LEARNER_MODEL"
    C_LEARNER_MODEL_MEMORY = "C_LEARNER_MODEL_MEMORY"
    D_FULL_STACK = "D_FULL_STACK"

    @property
    def description(self) -> str:
        return {
            ExperimentArm.A_STATIC_TUTOR: "static tutor (baseline, no personalization)",
            ExperimentArm.B_LEARNER_MODEL: "learner model only (mastery + misconception + state)",
            ExperimentArm.C_LEARNER_MODEL_MEMORY: "learner model + memory (semantic + procedural)",
            ExperimentArm.D_FULL_STACK: "learner model + memory + adaptive policy + DSPy",
        }[self]


class ExperimentMetric(str, Enum):
    LEARNING_GAIN = "LEARNING_GAIN"
    MASTERY_PROGRESSION = "MASTERY_PROGRESSION"
    MISCONCEPTION_RESOLUTION = "MISCONCEPTION_RESOLUTION"
    RETENTION = "RETENTION"
    TASK_SUCCESS = "TASK_SUCCESS"
    HINT_DEPENDENCY = "HINT_DEPENDENCY"
    LEARNING_MILESTONE_COMPLETION = "LEARNING_MILESTONE_COMPLETION"
    VALIDATED_PRACTICE_FREQUENCY = "VALIDATED_PRACTICE_FREQUENCY"


ALLOWED_OUTCOME_METRICS = frozenset(
    {
        ExperimentMetric.LEARNING_GAIN,
        ExperimentMetric.MASTERY_PROGRESSION,
        ExperimentMetric.MISCONCEPTION_RESOLUTION,
        ExperimentMetric.RETENTION,
        ExperimentMetric.TASK_SUCCESS,
        ExperimentMetric.HINT_DEPENDENCY,
        ExperimentMetric.LEARNING_MILESTONE_COMPLETION,
        ExperimentMetric.VALIDATED_PRACTICE_FREQUENCY,
    }
)

PROHIBITED_OPTIMIZATION_TARGETS = frozenset(
    {"daily_opens", "chat_messages", "click_through", "page_views", "logins"}
)


@dataclass(frozen=True)
class PopulationSpec:
    min_sessions_per_arm: int
    min_total_sessions: int
    power: float
    significance_level: float = 0.05

    def __post_init__(self) -> None:
        if self.min_sessions_per_arm < 1:
            raise ValueError("min_sessions_per_arm must be >= 1")
        if self.min_total_sessions < self.min_sessions_per_arm * 2:
            raise ValueError(
                "min_total_sessions must be >= min_sessions_per_arm * 2"
            )
        if not (0 < self.power < 1):
            raise ValueError("power must be in (0, 1)")
        if not (0 < self.significance_level < 0.5):
            raise ValueError("significance_level must be in (0, 0.5)")


@dataclass
class ArmObservation:
    arm: ExperimentArm
    metric: ExperimentMetric
    samples: List[float] = field(default_factory=list)

    @property
    def count(self) -> int:
        return len(self.samples)

    @property
    def mean(self) -> float:
        if not self.samples:
            return 0.0
        return sum(self.samples) / len(self.samples)

    @property
    def variance(self) -> float:
        if len(self.samples) < 2:
            return 0.0
        mean = self.mean
        return sum((x - mean) ** 2 for x in self.samples) / (len(self.samples) - 1)


@dataclass
class ConfidenceInterval:
    metric: ExperimentMetric
    arm: ExperimentArm
    lower: float
    upper: float
    mean: float
    n: int
    excludes_zero: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "metric": self.metric.value,
            "arm": self.arm.value,
            "mean": self.mean,
            "lower": self.lower,
            "upper": self.upper,
            "n": self.n,
            "excludesZero": self.excludes_zero,
        }


@dataclass(frozen=True)
class Experiment:
    experiment_id: str
    hypothesis: str
    population: PopulationSpec
    treatment: ExperimentArm
    control: ExperimentArm
    metrics: List[ExperimentMetric]
    duration_days: int
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    analysis_summary: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.hypothesis or not self.hypothesis.strip():
            raise ValueError("hypothesis is required")
        if self.treatment is self.control:
            raise ValueError("treatment and control must be different arms")
        if not self.metrics:
            raise ValueError("metrics must be non-empty")
        if self.duration_days < 1:
            raise ValueError("duration_days must be >= 1")
        prohibited = set(self.metrics) & PROHIBITED_OPTIMIZATION_TARGETS
        if prohibited:
            raise ValueError(
                f"metrics include prohibited optimization targets: {prohibited}"
            )


@dataclass
class ExperimentRun:
    experiment_id: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    observations: Dict[ExperimentArm, Dict[ExperimentMetric, ArmObservation]] = field(
        default_factory=lambda: defaultdict(lambda: defaultdict(lambda: ArmObservation))
    )
    confidence_intervals: List[ConfidenceInterval] = field(default_factory=list)
    winner_per_metric: Dict[ExperimentMetric, ExperimentArm] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "experimentId": self.experiment_id,
            "startedAt": self.started_at.isoformat(),
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
            "confidenceIntervals": [ci.to_dict() for ci in self.confidence_intervals],
            "winnerPerMetric": {
                m.value: a.value for m, a in self.winner_per_metric.items()
            },
        }


def _percentile(sorted_samples: List[float], q: float) -> float:
    if not sorted_samples:
        return 0.0
    if q <= 0:
        return sorted_samples[0]
    if q >= 1:
        return sorted_samples[-1]
    n = len(sorted_samples)
    pos = q * (n - 1)
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return sorted_samples[lo]
    frac = pos - lo
    return sorted_samples[lo] + (sorted_samples[hi] - sorted_samples[lo]) * frac


def bootstrap_confidence_interval(
    samples: List[float],
    *,
    confidence: float = 0.95,
    resamples: int = 1000,
    seed: int = 20261005,
) -> ConfidenceInterval | None:
    if len(samples) < 2:
        return None
    if not (0 < confidence < 1):
        raise ValueError("confidence must be in (0, 1)")
    rng = random.Random(seed)
    boot_means: List[float] = []
    n = len(samples)
    for _ in range(resamples):
        resample = [samples[rng.randrange(n)] for _ in range(n)]
        boot_means.append(sum(resample) / n)
    boot_means.sort()
    alpha = (1 - confidence) / 2
    lower = _percentile(boot_means, alpha)
    upper = _percentile(boot_means, 1 - alpha)
    mean = sum(samples) / n
    excludes_zero = lower > 0 or upper < 0
    return ConfidenceInterval(
        metric=ExperimentMetric.LEARNING_GAIN,
        arm=ExperimentArm.A_STATIC_TUTOR,
        lower=lower,
        upper=upper,
        mean=mean,
        n=n,
        excludes_zero=excludes_zero,
    )


__all__ = [
    "ExperimentArm",
    "ExperimentMetric",
    "ALLOWED_OUTCOME_METRICS",
    "PROHIBITED_OPTIMIZATION_TARGETS",
    "PopulationSpec",
    "ArmObservation",
    "ConfidenceInterval",
    "Experiment",
    "ExperimentRun",
    "bootstrap_confidence_interval",
]