from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class Procedure:
    procedure_id: str
    learner_id: str
    name: str
    steps: List[str] = field(default_factory=list)
    applicability: List[str] = field(default_factory=list)
    confidence: float = 0.5
    evidence_count: int = 1
    last_used_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.steps:
            raise ValueError("procedure must have at least one step")
        if not (0.0 <= self.confidence <= 1.0):
            raise ValueError(f"confidence must be in [0, 1], got {self.confidence}")
        if self.evidence_count < 1:
            raise ValueError(f"evidence_count must be >= 1, got {self.evidence_count}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "procedureId": self.procedure_id,
            "learnerId": self.learner_id,
            "name": self.name,
            "steps": list(self.steps),
            "applicability": list(self.applicability),
            "confidence": self.confidence,
            "evidenceCount": self.evidence_count,
            "lastUsedAt": self.last_used_at.isoformat(),
            "createdAt": self.created_at.isoformat(),
            "metadata": dict(self.metadata),
        }


class ProceduralMemory:
    def __init__(self) -> None:
        self._procedures: Dict[str, Procedure] = {}

    def upsert(self, procedure: Procedure) -> Procedure:
        existing_id = self._find_existing(procedure.learner_id, procedure.name)
        if existing_id is None:
            self._procedures[procedure.procedure_id] = procedure
            return procedure
        existing = self._procedures[existing_id]
        merged = Procedure(
            procedure_id=existing.procedure_id,
            learner_id=existing.learner_id,
            name=existing.name,
            steps=list(existing.steps) + [
                s for s in procedure.steps if s not in existing.steps
            ],
            applicability=list(set(existing.applicability) | set(procedure.applicability)),
            confidence=min(1.0, max(existing.confidence, procedure.confidence)),
            evidence_count=existing.evidence_count + procedure.evidence_count,
            last_used_at=datetime.now(timezone.utc),
            created_at=existing.created_at,
            metadata={**existing.metadata, **procedure.metadata},
        )
        self._procedures[existing_id] = merged
        return merged

    def recall(
        self,
        learner_id: str,
        *,
        applicability: Optional[str] = None,
        min_confidence: float = 0.0,
    ) -> List[Procedure]:
        procedures = [
            p
            for p in self._procedures.values()
            if p.learner_id == learner_id
            and (applicability is None or applicability in p.applicability)
            and p.confidence >= min_confidence
        ]
        procedures.sort(key=lambda p: p.confidence, reverse=True)
        return procedures

    def delete(self, procedure_id: str) -> bool:
        return self._procedures.pop(procedure_id, None) is not None

    def delete_for_learner(self, learner_id: str) -> int:
        to_delete = [
            pid for pid, p in self._procedures.items() if p.learner_id == learner_id
        ]
        for pid in to_delete:
            self._procedures.pop(pid, None)
        return len(to_delete)

    def _find_existing(self, learner_id: str, name: str) -> Optional[str]:
        for pid, p in self._procedures.items():
            if p.learner_id == learner_id and p.name == name:
                return pid
        return None


__all__ = ["Procedure", "ProceduralMemory"]