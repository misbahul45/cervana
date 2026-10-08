from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class PreferenceSource(str, Enum):
    DECLARED = "DECLARED"
    OBSERVED = "OBSERVED"
    INFERRED = "INFERRED"


class PreferenceKey(str, Enum):
    EXPLANATION_STYLE = "EXPLANATION_STYLE"
    PACING = "PACING"
    DIFFICULTY_TOLERANCE = "DIFFICULTY_TOLERANCE"
    HINT_DEPENDENCY = "HINT_DEPENDENCY"
    FORMAT_PREFERENCE = "FORMAT_PREFERENCE"


@dataclass
class Preference:
    preference_key: PreferenceKey
    value: str
    source: PreferenceSource
    confidence: float = 0.5
    evidence_count: int = 1
    last_observed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        if not (0.0 <= self.confidence <= 1.0):
            raise ValueError(f"confidence must be in [0,1], got {self.confidence}")
        if self.evidence_count < 1:
            raise ValueError(f"evidence_count must be >= 1, got {self.evidence_count}")

    def reinforce(self, additional: int = 1, confidence_boost: float = 0.05) -> "Preference":
        new_confidence = min(1.0, self.confidence + confidence_boost)
        return Preference(
            preference_key=self.preference_key,
            value=self.value,
            source=self.source,
            confidence=new_confidence,
            evidence_count=self.evidence_count + additional,
            last_observed_at=datetime.now(timezone.utc),
        )

    def decay(
        self,
        decay_rate: float = 0.02,
        *,
        half_life_days: float = 30.0,
        now: Optional[datetime] = None,
    ) -> "Preference":
        reference_now = now or datetime.now(timezone.utc)
        age_seconds = max(0.0, (reference_now - self.last_observed_at).total_seconds())
        age_days = age_seconds / 86400.0
        recency_multiplier = 0.5 ** (age_days / half_life_days)
        effective_decay = decay_rate * (1.0 + (1.0 - recency_multiplier) * 4.0)
        new_confidence = max(0.0, self.confidence - effective_decay)
        return Preference(
            preference_key=self.preference_key,
            value=self.value,
            source=self.source,
            confidence=new_confidence,
            evidence_count=self.evidence_count,
            last_observed_at=self.last_observed_at,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "preferenceKey": self.preference_key.value,
            "value": self.value,
            "source": self.source.value,
            "confidence": self.confidence,
            "evidenceCount": self.evidence_count,
            "lastObservedAt": self.last_observed_at.isoformat(),
        }


__all__ = ["PreferenceSource", "PreferenceKey", "Preference"]