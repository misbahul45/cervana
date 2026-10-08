from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class LearnerSignalKind(str, Enum):
    OBSERVATION = "OBSERVATION"
    DERIVED = "DERIVED"
    INFERENCE = "INFERENCE"
    PREFERENCE = "PREFERENCE"
    SYSTEM_STATE = "SYSTEM_STATE"


class MasteryChangeKind(str, Enum):
    CORRECT_ANSWER = "CORRECT_ANSWER"
    INCORRECT_ANSWER = "INCORRECT_ANSWER"
    HINT_USED = "HINT_USED"
    MISCONCEPTION_RESOLVED = "MISCONCEPTION_RESOLVED"
    OFF_TOPIC = "OFF_TOPIC"


class GoalKind(str, Enum):
    MASTERY = "MASTERY"
    COMPLETION = "COMPLETION"
    EXPLORATION = "EXPLORATION"
    REMEDIATION = "REMEDIATION"


@dataclass(frozen=True)
class LearningEvent:
    event_id: str
    learner_id: str
    trace_id: str
    concept_id: str
    kind: MasteryChangeKind
    occurred_at: datetime
    source: str = "ai-api"
    confidence_delta: float = 0.0
    mastery_delta: float = 0.0
    hint_level: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "eventId": self.event_id,
            "learnerId": self.learner_id,
            "traceId": self.trace_id,
            "conceptId": self.concept_id,
            "kind": self.kind.value,
            "occurredAt": self.occurred_at.isoformat(),
            "source": self.source,
            "confidenceDelta": self.confidence_delta,
            "masteryDelta": self.mastery_delta,
            "hintLevel": self.hint_level,
            "metadata": dict(self.metadata),
        }


@dataclass(frozen=True)
class Goal:
    goal_id: str
    learner_id: str
    concept_id: str
    kind: GoalKind
    target_mastery: float = 0.85
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "goalId": self.goal_id,
            "learnerId": self.learner_id,
            "conceptId": self.concept_id,
            "kind": self.kind.value,
            "targetMastery": self.target_mastery,
            "createdAt": self.created_at.isoformat(),
        }


__all__ = [
    "LearnerSignalKind",
    "MasteryChangeKind",
    "GoalKind",
    "LearningEvent",
    "Goal",
]