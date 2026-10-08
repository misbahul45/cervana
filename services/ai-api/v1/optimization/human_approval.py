from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


@dataclass(frozen=True)
class HumanApproval:
    candidate_id: str
    status: ApprovalStatus = ApprovalStatus.PENDING
    decided_by: Optional[str] = None
    decided_at: Optional[datetime] = None
    rationale: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "candidateId": self.candidate_id,
            "status": self.status.value,
            "decidedBy": self.decided_by,
            "decidedAt": self.decided_at.isoformat() if self.decided_at else None,
            "rationale": self.rationale,
        }


class HumanApprovalRegistry:
    def __init__(self) -> None:
        self._approvals: Dict[str, HumanApproval] = {}

    def submit(self, candidate_id: str) -> HumanApproval:
        if candidate_id in self._approvals:
            existing = self._approvals[candidate_id]
            if existing.status is not ApprovalStatus.PENDING:
                raise ValueError(
                    f"candidate {candidate_id} already decided: {existing.status.value}"
                )
            return existing
        approval = HumanApproval(candidate_id=candidate_id)
        self._approvals[candidate_id] = approval
        return approval

    def approve(self, candidate_id: str, *, decided_by: str, rationale: str = "") -> HumanApproval:
        return self._decide(candidate_id, decided_by, rationale, ApprovalStatus.APPROVED)

    def reject(self, candidate_id: str, *, decided_by: str, rationale: str = "") -> HumanApproval:
        return self._decide(candidate_id, decided_by, rationale, ApprovalStatus.REJECTED)

    def get(self, candidate_id: str) -> Optional[HumanApproval]:
        return self._approvals.get(candidate_id)

    def is_approved(self, candidate_id: str) -> bool:
        approval = self._approvals.get(candidate_id)
        return approval is not None and approval.status is ApprovalStatus.APPROVED

    def _decide(
        self,
        candidate_id: str,
        decided_by: str,
        rationale: str,
        status: ApprovalStatus,
    ) -> HumanApproval:
        if not decided_by or not decided_by.strip():
            raise ValueError("decided_by is required and must be non-empty")
        existing = self._approvals.get(candidate_id)
        if existing is None:
            raise ValueError(f"no pending approval for candidate {candidate_id}")
        if existing.status is not ApprovalStatus.PENDING:
            raise ValueError(
                f"candidate {candidate_id} already decided: {existing.status.value}"
            )
        next_approval = HumanApproval(
            candidate_id=candidate_id,
            status=status,
            decided_by=decided_by,
            decided_at=datetime.now(timezone.utc),
            rationale=rationale,
        )
        self._approvals[candidate_id] = next_approval
        return next_approval


__all__ = ["ApprovalStatus", "HumanApproval", "HumanApprovalRegistry"]