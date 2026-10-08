from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class BaselineSnapshot:
    baseline_id: str
    captured_at: datetime
    prompt_version: str
    policy_version: str
    model_version: str
    retrieval_version: str
    benchmark_version: str
    evaluator_version: str
    metrics: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "baselineId": self.baseline_id,
            "capturedAt": self.captured_at.isoformat(),
            "promptVersion": self.prompt_version,
            "policyVersion": self.policy_version,
            "modelVersion": self.model_version,
            "retrievalVersion": self.retrieval_version,
            "benchmarkVersion": self.benchmark_version,
            "evaluatorVersion": self.evaluator_version,
            "metrics": dict(self.metrics),
        }


@dataclass(frozen=True)
class Candidate:
    candidate_id: str
    base_prompt_version: str
    base_policy_version: str
    benchmark_version: str
    model_version: str
    evaluator_version: str
    candidate_artifact: str
    training_data_version: str
    candidate_metrics: Dict[str, float]
    baseline_metrics: Dict[str, float]
    failure_modes_targeted: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "candidateId": self.candidate_id,
            "basePromptVersion": self.base_prompt_version,
            "basePolicyVersion": self.base_policy_version,
            "benchmarkVersion": self.benchmark_version,
            "modelVersion": self.model_version,
            "evaluatorVersion": self.evaluator_version,
            "candidateArtifactHash": hash(self.candidate_artifact),
            "trainingDataVersion": self.training_data_version,
            "candidateMetrics": dict(self.candidate_metrics),
            "baselineMetrics": dict(self.baseline_metrics),
            "failureModesTargeted": list(self.failure_modes_targeted),
            "createdAt": self.created_at.isoformat(),
            "metadata": dict(self.metadata),
        }


__all__ = ["BaselineSnapshot", "Candidate"]