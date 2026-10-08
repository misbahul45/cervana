from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class MemorySource(str, Enum):
    DECLARED = "DECLARED"
    OBSERVED = "OBSERVED"
    INFERRED = "INFERRED"
    SYSTEM = "SYSTEM"


class MemoryDecision(str, Enum):
    ACCEPT = "ACCEPT"
    REJECT_LOW_SALIENCE = "REJECT_LOW_SALIENCE"
    REJECT_INSTRUCTION = "REJECT_INSTRUCTION"
    REJECT_NO_EVIDENCE = "REJECT_NO_EVIDENCE"
    REJECT_LOW_CONFIDENCE = "REJECT_LOW_CONFIDENCE"
    REJECT_NOVELTY = "REJECT_NOVELTY"
    REJECT_ONE_OFF = "REJECT_ONE_OFF"
    REJECT_PRIVACY = "REJECT_PRIVACY"
    REJECT_IRRELEVANT = "REJECT_IRRELEVANT"
    REJECT_UNSUPPORTED_CLAIM = "REJECT_UNSUPPORTED_CLAIM"


@dataclass(frozen=True)
class MemoryCandidate:
    candidate_id: str
    learner_id: str
    trait_key: str
    value: str
    source: MemorySource
    confidence: float = 0.5
    evidence_count: int = 1
    salience: float = 0.5
    novelty: float = 0.5
    recurrence_count: int = 1
    scope: str = "global"
    proposed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not (0.0 <= self.confidence <= 1.0):
            raise ValueError(f"confidence must be in [0, 1], got {self.confidence}")
        if not (0.0 <= self.salience <= 1.0):
            raise ValueError(f"salience must be in [0, 1], got {self.salience}")
        if not (0.0 <= self.novelty <= 1.0):
            raise ValueError(f"novelty must be in [0, 1], got {self.novelty}")
        if self.evidence_count < 1:
            raise ValueError(f"evidence_count must be >= 1, got {self.evidence_count}")
        if self.recurrence_count < 1:
            raise ValueError(f"recurrence_count must be >= 1, got {self.recurrence_count}")


_INSTRUCTION_LIKE_PATTERNS = [
    "ignore previous",
    "disregard prior",
    "forget earlier instructions",
    "system override",
    "you are now",
    "reveal your prompt",
    "reveal the system prompt",
    "developer instructions",
    "reveal your instructions",
    "override the policy",
    "override your policy",
]


_PII_PATTERNS = ["ssn", "social security", "credit card number", "passport number"]


class MemoryWritePolicy:
    def __init__(
        self,
        *,
        min_salience: float = 0.30,
        min_evidence_count: int = 1,
        min_confidence: float = 0.20,
        min_novelty: float = 0.10,
        min_recurrence_count: int = 1,
    ) -> None:
        if not (0 <= min_salience <= 1):
            raise ValueError("min_salience must be in [0, 1]")
        if min_evidence_count < 1:
            raise ValueError("min_evidence_count must be >= 1")
        if not (0 <= min_confidence <= 1):
            raise ValueError("min_confidence must be in [0, 1]")
        if not (0 <= min_novelty <= 1):
            raise ValueError("min_novelty must be in [0, 1]")
        if min_recurrence_count < 1:
            raise ValueError("min_recurrence_count must be >= 1")
        self.min_salience = min_salience
        self.min_evidence_count = min_evidence_count
        self.min_confidence = min_confidence
        self.min_novelty = min_novelty
        self.min_recurrence_count = min_recurrence_count

    @staticmethod
    def is_instruction_like(text: str) -> bool:
        if not text:
            return False
        lowered = text.lower()
        return any(pattern in lowered for pattern in _INSTRUCTION_LIKE_PATTERNS)

    @staticmethod
    def contains_pii(text: str) -> bool:
        if not text:
            return False
        lowered = text.lower()
        return any(pattern in lowered for pattern in _PII_PATTERNS)

    @staticmethod
    def is_irrelevant(text: str) -> bool:
        if not text:
            return True
        return len(text.strip()) < 3

    def decide(self, candidate: MemoryCandidate) -> MemoryDecision:
        if self.is_instruction_like(candidate.value):
            return MemoryDecision.REJECT_INSTRUCTION
        if self.contains_pii(candidate.value):
            return MemoryDecision.REJECT_PRIVACY
        if self.is_irrelevant(candidate.value):
            return MemoryDecision.REJECT_IRRELEVANT
        if candidate.salience < self.min_salience:
            return MemoryDecision.REJECT_LOW_SALIENCE
        if candidate.evidence_count < self.min_evidence_count:
            return MemoryDecision.REJECT_NO_EVIDENCE
        if candidate.confidence < self.min_confidence:
            return MemoryDecision.REJECT_LOW_CONFIDENCE
        if candidate.novelty < self.min_novelty:
            return MemoryDecision.REJECT_NOVELTY
        if candidate.recurrence_count < self.min_recurrence_count:
            return MemoryDecision.REJECT_ONE_OFF
        return MemoryDecision.ACCEPT


__all__ = [
    "MemorySource",
    "MemoryDecision",
    "MemoryCandidate",
    "MemoryWritePolicy",
]