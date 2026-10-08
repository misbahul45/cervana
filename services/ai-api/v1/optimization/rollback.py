from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List


@dataclass(frozen=True)
class RollbackEvent:
    candidate_id: str
    restored_prompt_version: str
    trigger: str
    regression_dimension: str
    regression_magnitude: float
    detected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "candidateId": self.candidate_id,
            "restoredPromptVersion": self.restored_prompt_version,
            "trigger": self.trigger,
            "regressionDimension": self.regression_dimension,
            "regressionMagnitude": self.regression_magnitude,
            "detectedAt": self.detected_at.isoformat(),
            "metadata": dict(self.metadata),
        }


class RollbackManager:
    """Master prompt §77.

    regression > 10% within 1 hour  → automatic rollback to previous ACTIVE
    registry must retain candidate history
    """

    REGRESSION_THRESHOLD = 0.10
    WINDOW_SECONDS = 3600

    def __init__(self) -> None:
        self.history: List[RollbackEvent] = []
        self._deployment_started_at: Dict[str, datetime] = {}

    def start_deployment(self, candidate_id: str) -> None:
        self._deployment_started_at[candidate_id] = datetime.now(timezone.utc)

    def detect_regression(
        self,
        *,
        candidate_id: str,
        baseline_metrics: Dict[str, float],
        current_metrics: Dict[str, float],
        now: datetime | None = None,
    ) -> RollbackEvent | None:
        started_at = self._deployment_started_at.get(candidate_id)
        if started_at is None:
            return None
        reference_now = now or datetime.now(timezone.utc)
        elapsed = (reference_now - started_at).total_seconds()
        if elapsed > self.WINDOW_SECONDS:
            return None
        for dim, baseline in baseline_metrics.items():
            current = current_metrics.get(dim, baseline)
            if baseline <= 0:
                continue
            relative_drop = (baseline - current) / baseline
            if relative_drop > self.REGRESSION_THRESHOLD:
                event = RollbackEvent(
                    candidate_id=candidate_id,
                    restored_prompt_version=baseline_metrics.get("_baseline_prompt_version", "previous"),
                    trigger="REGRESSION_OVER_10_PERCENT_IN_1_HOUR",
                    regression_dimension=dim,
                    regression_magnitude=relative_drop,
                    metadata={
                        "baseline": baseline,
                        "current": current,
                        "elapsedSeconds": elapsed,
                    },
                )
                self.history.append(event)
                return event
        return None

    def clear(self, candidate_id: str) -> None:
        self._deployment_started_at.pop(candidate_id, None)


__all__ = ["RollbackEvent", "RollbackManager"]