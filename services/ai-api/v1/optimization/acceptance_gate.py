from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass(frozen=True)
class AcceptanceDecision:
    candidate_id: str
    accepted: bool
    failed_dimensions: List[str] = field(default_factory=list)
    reasons: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "candidateId": self.candidate_id,
            "accepted": self.accepted,
            "failedDimensions": list(self.failed_dimensions),
            "reasons": list(self.reasons),
            "details": dict(self.details),
        }


class AcceptanceGate:
    """Enforce master prompt §73.

    All criteria must pass. A single failure rejects the candidate.
    No dimension may be relaxed by the optimizer.
    """

    REQUIRED_RAISING = ["grounding", "pedagogy", "personalization", "correctness"]
    REQUIRED_LOWERING = ["hallucination_rate"]

    def evaluate(
        self,
        candidate_id: str,
        baseline_metrics: Dict[str, float],
        candidate_metrics: Dict[str, float],
        *,
        latency_p95_ms_baseline: float,
        latency_p95_ms_candidate: float,
        cost_per_1k_baseline: float,
        cost_per_1k_candidate: float,
    ) -> AcceptanceDecision:
        failed: List[str] = []
        reasons: List[str] = []

        for key in self.REQUIRED_RAISING:
            if key not in candidate_metrics or key not in baseline_metrics:
                failed.append(key)
                reasons.append(f"{key} missing from candidate or baseline metrics")
                continue
            if candidate_metrics[key] < baseline_metrics[key]:
                failed.append(key)
                reasons.append(
                    f"{key} regression: candidate={candidate_metrics[key]:.4f} "
                    f"< baseline={baseline_metrics[key]:.4f}"
                )

        if "hallucination_rate" not in candidate_metrics or "hallucination_rate" not in baseline_metrics:
            failed.append("hallucination_rate")
            reasons.append("hallucination_rate missing from candidate or baseline metrics")
        else:
            threshold = baseline_metrics["hallucination_rate"] * 1.05
            if candidate_metrics["hallucination_rate"] > threshold:
                failed.append("hallucination_rate")
                reasons.append(
                    f"hallucination_rate exceeds 5% tolerance: "
                    f"candidate={candidate_metrics['hallucination_rate']:.4f} > {threshold:.4f}"
                )

        if latency_p95_ms_candidate > latency_p95_ms_baseline * 1.10:
            failed.append("p95_latency")
            reasons.append(
                f"p95_latency exceeds 10% tolerance: "
                f"candidate={latency_p95_ms_candidate:.1f}ms > {latency_p95_ms_baseline * 1.10:.1f}ms"
            )

        if cost_per_1k_candidate > cost_per_1k_baseline * 1.20:
            failed.append("cost_per_1k")
            reasons.append(
                f"cost_per_1k exceeds 20% tolerance: "
                f"candidate=${cost_per_1k_candidate:.4f} > ${cost_per_1k_baseline * 1.20:.4f}"
            )

        accepted = len(failed) == 0
        return AcceptanceDecision(
            candidate_id=candidate_id,
            accepted=accepted,
            failed_dimensions=failed,
            reasons=reasons,
        )


__all__ = ["AcceptanceDecision", "AcceptanceGate"]