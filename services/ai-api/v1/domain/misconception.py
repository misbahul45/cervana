from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class MisconceptionType(str, Enum):
    CONTRA_ACCOUNT_CONFUSION = "CONTRA_ACCOUNT_CONFUSION"
    DEBIT_CREDIT_DIRECTION_ERROR = "DEBIT_CREDIT_DIRECTION_ERROR"
    ADJUSTING_ENTRY_ERROR = "ADJUSTING_ENTRY_ERROR"
    FINANCIAL_STATEMENT_MAPPING_ERROR = "FINANCIAL_STATEMENT_MAPPING_ERROR"
    MULTI_STEP_CASE_REASONING_ERROR = "MULTI_STEP_CASE_REASONING_ERROR"
    MISCONCEPTION_NOT_REPAIRED = "MISCONCEPTION_NOT_REPAIRED"
    WRONG_PREREQUISITE = "WRONG_PREREQUISITE"
    OVER_SCAFFOLDING = "OVER_SCAFFOLDING"
    UNDER_SCAFFOLDING = "UNDER_SCAFFOLDING"
    OTHER = "OTHER"


class MisconceptionStatus(str, Enum):
    CANDIDATE = "CANDIDATE"
    CONFIRMED = "CONFIRMED"
    PERSISTENT = "PERSISTENT"
    RESOLVED = "RESOLVED"


class Misconception:
    __slots__ = (
        "misconception_id",
        "concept_id",
        "type",
        "confidence",
        "evidence_count",
        "first_observed_at",
        "last_observed_at",
        "status",
        "resolution_evidence",
        "description",
    )

    def __init__(
        self,
        misconception_id: str,
        concept_id: str,
        type: MisconceptionType = MisconceptionType.OTHER,
        confidence: float = 0.5,
        evidence_count: int = 1,
        first_observed_at: Optional[datetime] = None,
        last_observed_at: Optional[datetime] = None,
        status: MisconceptionStatus = MisconceptionStatus.CANDIDATE,
        resolution_evidence: Optional[List[str]] = None,
        description: str = "",
    ) -> None:
        if not (0.0 <= confidence <= 1.0):
            raise ValueError(f"confidence must be in [0, 1], got {confidence}")
        if evidence_count < 1:
            raise ValueError(f"evidence_count must be >= 1, got {evidence_count}")
        self.misconception_id = misconception_id
        self.concept_id = concept_id
        self.type = type
        self.confidence = confidence
        self.evidence_count = evidence_count
        self.first_observed_at = first_observed_at or datetime.now(timezone.utc)
        self.last_observed_at = last_observed_at or self.first_observed_at
        self.status = status
        self.resolution_evidence = list(resolution_evidence or [])
        self.description = description

    def add_evidence(self) -> None:
        self.evidence_count += 1
        self.last_observed_at = datetime.now(timezone.utc)

    def confirm(self) -> None:
        self.status = MisconceptionStatus.CONFIRMED
        self.confidence = max(self.confidence, 0.7)

    def mark_resolved(self, evidence: str) -> None:
        if not evidence:
            raise ValueError("resolution evidence cannot be empty")
        self.resolution_evidence.append(evidence)
        self.status = MisconceptionStatus.RESOLVED

    def to_dict(self) -> Dict[str, Any]:
        return {
            "misconceptionId": self.misconception_id,
            "conceptId": self.concept_id,
            "type": self.type.value if isinstance(self.type, MisconceptionType) else self.type,
            "confidence": self.confidence,
            "evidenceCount": self.evidence_count,
            "firstObservedAt": self.first_observed_at.isoformat(),
            "lastObservedAt": self.last_observed_at.isoformat(),
            "status": self.status.value if isinstance(self.status, MisconceptionStatus) else self.status,
            "resolutionEvidence": list(self.resolution_evidence),
            "description": self.description,
        }


__all__ = ["Misconception", "MisconceptionType", "MisconceptionStatus"]