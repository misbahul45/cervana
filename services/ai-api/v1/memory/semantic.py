from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class SemanticSource(str, Enum):
    DECLARED = "DECLARED"
    OBSERVED = "OBSERVED"
    INFERRED = "INFERRED"
    SYSTEM = "SYSTEM"


@dataclass(frozen=True)
class SemanticTrait:
    trait_id: str
    learner_id: str
    trait_key: str
    value: str
    source: SemanticSource
    confidence: float
    evidence_count: int
    last_observed_at: datetime
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    scope: str = "global"
    provenance: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not (0.0 <= self.confidence <= 1.0):
            raise ValueError(f"confidence must be in [0, 1], got {self.confidence}")
        if self.evidence_count < 1:
            raise ValueError(f"evidence_count must be >= 1, got {self.evidence_count}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "traitId": self.trait_id,
            "learnerId": self.learner_id,
            "traitKey": self.trait_key,
            "value": self.value,
            "source": self.source.value,
            "confidence": self.confidence,
            "evidenceCount": self.evidence_count,
            "lastObservedAt": self.last_observed_at.isoformat(),
            "createdAt": self.created_at.isoformat(),
            "scope": self.scope,
            "provenance": dict(self.provenance),
        }


class SemanticLearnerMemory:
    def __init__(self) -> None:
        self._traits: Dict[str, SemanticTrait] = {}

    def upsert(self, trait: SemanticTrait) -> SemanticTrait:
        existing_id = self._find_existing(trait.learner_id, trait.trait_key, trait.scope)
        if existing_id is None:
            self._traits[trait.trait_id] = trait
            return trait
        existing = self._traits[existing_id]
        if existing.value == trait.value:
            merged = SemanticTrait(
                trait_id=existing.trait_id,
                learner_id=existing.learner_id,
                trait_key=existing.trait_key,
                value=existing.value,
                source=existing.source,
                confidence=min(1.0, max(existing.confidence, trait.confidence) + 0.05),
                evidence_count=existing.evidence_count + trait.evidence_count,
                last_observed_at=datetime.now(timezone.utc),
                created_at=existing.created_at,
                scope=existing.scope,
                provenance={**existing.provenance, **trait.provenance},
            )
        else:
            keep_existing = existing.confidence >= trait.confidence
            winner = existing if keep_existing else trait
            merged = SemanticTrait(
                trait_id=winner.trait_id,
                learner_id=winner.learner_id,
                trait_key=winner.trait_key,
                value=winner.value,
                source=winner.source,
                confidence=max(existing.confidence, trait.confidence),
                evidence_count=existing.evidence_count + trait.evidence_count,
                last_observed_at=datetime.now(timezone.utc),
                created_at=existing.created_at,
                scope=winner.scope,
                provenance={
                    "winnerSource": winner.source.value,
                    "conflict": True,
                    **winner.provenance,
                },
            )
        self._traits[existing_id] = merged
        return merged

    def recall(
        self,
        learner_id: str,
        *,
        trait_key: Optional[str] = None,
        min_confidence: float = 0.0,
    ) -> List[SemanticTrait]:
        traits = [
            t
            for t in self._traits.values()
            if t.learner_id == learner_id
            and (trait_key is None or t.trait_key == trait_key)
            and t.confidence >= min_confidence
        ]
        traits.sort(key=lambda t: (t.confidence, t.evidence_count), reverse=True)
        return traits

    def delete(self, trait_id: str) -> bool:
        return self._traits.pop(trait_id, None) is not None

    def delete_for_learner(self, learner_id: str) -> int:
        to_delete = [
            tid for tid, t in self._traits.items() if t.learner_id == learner_id
        ]
        for tid in to_delete:
            self._traits.pop(tid, None)
        return len(to_delete)

    def _find_existing(
        self, learner_id: str, trait_key: str, scope: str
    ) -> Optional[str]:
        for tid, t in self._traits.items():
            if t.learner_id == learner_id and t.trait_key == trait_key and t.scope == scope:
                return tid
        return None


__all__ = ["SemanticSource", "SemanticTrait", "SemanticLearnerMemory"]