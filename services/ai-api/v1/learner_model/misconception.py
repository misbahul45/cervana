from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from v1.domain.misconception import Misconception, MisconceptionStatus, MisconceptionType


class MisconceptionLifecycleStage(str, Enum):
    CANDIDATE = "CANDIDATE"
    CONFIRMED = "CONFIRMED"
    PERSISTENT = "PERSISTENT"
    RESOLVED = "RESOLVED"


@dataclass
class MisconceptionEvidence:
    event_id: str
    observed_at: datetime
    snippet: str = ""
    source: str = "ai-api"


@dataclass
class TrackedMisconception:
    misconception: Misconception
    stage: MisconceptionLifecycleStage = MisconceptionLifecycleStage.CANDIDATE
    evidence: List[MisconceptionEvidence] = field(default_factory=list)

    def add_evidence(self, evidence: MisconceptionEvidence) -> None:
        self.evidence.append(evidence)
        if len(self.evidence) >= 3 and self.stage == MisconceptionLifecycleStage.CANDIDATE:
            self.confirm()
        elif len(self.evidence) >= 5 and self.stage == MisconceptionLifecycleStage.CONFIRMED:
            self.mark_persistent()
        self.misconception.add_evidence()

    def confirm(self) -> None:
        if self.stage != MisconceptionLifecycleStage.CANDIDATE:
            return
        self.stage = MisconceptionLifecycleStage.CONFIRMED
        self.misconception.confirm()

    def mark_persistent(self) -> None:
        if self.stage in (
            MisconceptionLifecycleStage.RESOLVED,
            MisconceptionLifecycleStage.PERSISTENT,
        ):
            return
        self.stage = MisconceptionLifecycleStage.PERSISTENT
        self.misconception.status = MisconceptionStatus.PERSISTENT

    def mark_resolved(self, evidence_text: str) -> None:
        self.stage = MisconceptionLifecycleStage.RESOLVED
        self.misconception.mark_resolved(evidence_text)

    @property
    def evidence_count(self) -> int:
        return len(self.evidence)

    def to_dict(self) -> Dict[str, Any]:
        return {
            **self.misconception.to_dict(),
            "stage": self.stage.value,
            "evidenceCount": self.evidence_count,
            "evidence": [
                {"eventId": e.event_id, "observedAt": e.observed_at.isoformat(), "snippet": e.snippet}
                for e in self.evidence
            ],
        }


class MisconceptionPipeline:
    CONFIRM_THRESHOLD = 3
    PERSIST_THRESHOLD = 5

    def __init__(self) -> None:
        self._tracked: Dict[str, TrackedMisconception] = {}

    def propose(self, misconception: Misconception) -> TrackedMisconception:
        existing = self._tracked.get(misconception.misconception_id)
        if existing is not None:
            existing.add_evidence(
                MisconceptionEvidence(
                    event_id=misconception.misconception_id,
                    observed_at=datetime.now(timezone.utc),
                    snippet=misconception.description,
                )
            )
            return existing
        tracked = TrackedMisconception(misconception=misconception)
        tracked.add_evidence(
            MisconceptionEvidence(
                event_id=misconception.misconception_id,
                observed_at=datetime.now(timezone.utc),
                snippet=misconception.description,
            )
        )
        self._tracked[misconception.misconception_id] = tracked
        return tracked

    def get(self, misconception_id: str) -> Optional[TrackedMisconception]:
        return self._tracked.get(misconception_id)

    def all_for_concept(self, concept_id: str) -> List[TrackedMisconception]:
        return [
            t
            for t in self._tracked.values()
            if t.misconception.concept_id == concept_id
            and t.stage != MisconceptionLifecycleStage.RESOLVED
        ]

    def resolve(self, misconception_id: str, evidence_text: str) -> None:
        tracked = self._tracked.get(misconception_id)
        if tracked is None:
            return
        tracked.mark_resolved(evidence_text)


__all__ = [
    "MisconceptionLifecycleStage",
    "MisconceptionEvidence",
    "TrackedMisconception",
    "MisconceptionPipeline",
]