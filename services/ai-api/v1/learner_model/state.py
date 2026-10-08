from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from v1.learner_model.events import Goal, LearningEvent
from v1.learner_model.misconception import (
    MisconceptionLifecycleStage,
    MisconceptionPipeline,
    TrackedMisconception,
)
from v1.learner_model.preferences import (
    Preference,
    PreferenceKey,
    PreferenceSource,
)
from v1.memory.semantic import SemanticLearnerMemory


class SessionStage(str, Enum):
    ONBOARDING = "ONBOARDING"
    INSTRUCTION = "INSTRUCTION"
    PRACTICE = "PRACTICE"
    REMEDIATION = "REMEDIATION"
    REVIEW = "REVIEW"
    COMPLETED = "COMPLETED"


@dataclass
class ConceptMastery:
    concept_id: str
    score: float = 0.5
    confidence: float = 0.5
    evidence_count: int = 0
    last_updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        if not (0.0 <= self.score <= 1.0):
            raise ValueError(f"mastery score must be in [0,1], got {self.score}")
        if not (0.0 <= self.confidence <= 1.0):
            raise ValueError(f"confidence must be in [0,1], got {self.confidence}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conceptId": self.concept_id,
            "score": self.score,
            "confidence": self.confidence,
            "evidenceCount": self.evidence_count,
            "lastUpdatedAt": self.last_updated_at.isoformat(),
        }


@dataclass
class LearnerState:
    learner_id: str
    state_version: int = 1
    identity_context: Dict[str, Any] = field(default_factory=dict)
    current_stage: SessionStage = SessionStage.ONBOARDING
    concept_mastery: Dict[str, ConceptMastery] = field(default_factory=dict)
    misconceptions: MisconceptionPipeline = field(default_factory=MisconceptionPipeline)
    preferences: Dict[PreferenceKey, Preference] = field(default_factory=dict)
    goals: List[Goal] = field(default_factory=list)
    recent_activity: List[LearningEvent] = field(default_factory=list)
    retention_signals: Dict[str, float] = field(default_factory=dict)
    error_patterns: Dict[str, int] = field(default_factory=dict)
    hint_dependency: float = 0.0
    difficulty_tolerance: float = 0.5
    memory_references: List[str] = field(default_factory=list)
    session_state: Dict[str, Any] = field(default_factory=dict)
    semantic: SemanticLearnerMemory = field(default_factory=SemanticLearnerMemory)

    def get_mastery(self, concept_id: str) -> ConceptMastery:
        mastery = self.concept_mastery.get(concept_id)
        if mastery is None:
            mastery = ConceptMastery(concept_id=concept_id)
            self.concept_mastery[concept_id] = mastery
        return mastery

    def record_event(self, event: LearningEvent) -> None:
        self.recent_activity.append(event)
        if len(self.recent_activity) > 100:
            self.recent_activity = self.recent_activity[-100:]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "learnerId": self.learner_id,
            "stateVersion": self.state_version,
            "currentStage": self.current_stage.value,
            "conceptMastery": {k: v.to_dict() for k, v in self.concept_mastery.items()},
            "openMisconceptions": [t.to_dict() for t in self.misconceptions._tracked.values() if t.stage != MisconceptionLifecycleStage.RESOLVED],
            "preferences": {k.value: v.to_dict() for k, v in self.preferences.items()},
            "goals": [g.to_dict() for g in self.goals],
            "recentActivityCount": len(self.recent_activity),
            "retentionSignals": dict(self.retention_signals),
            "errorPatterns": dict(self.error_patterns),
            "hintDependency": self.hint_dependency,
            "difficultyTolerance": self.difficulty_tolerance,
            "memoryReferences": list(self.memory_references),
            "sessionState": dict(self.session_state),
        }

    def clone_for_replay(self) -> "LearnerState":
        return LearnerState(
            learner_id=self.learner_id,
            state_version=self.state_version + 1,
            identity_context=dict(self.identity_context),
            current_stage=self.current_stage,
            concept_mastery={k: ConceptMastery(**v.to_dict()) for k, v in self.concept_mastery.items()},
            misconceptions=self.misconceptions,
            preferences=dict(self.preferences),
            goals=list(self.goals),
            recent_activity=list(self.recent_activity),
            retention_signals=dict(self.retention_signals),
            error_patterns=dict(self.error_patterns),
            hint_dependency=self.hint_dependency,
            difficulty_tolerance=self.difficulty_tolerance,
            memory_references=list(self.memory_references),
            session_state=dict(self.session_state),
        )


__all__ = ["SessionStage", "ConceptMastery", "LearnerState"]