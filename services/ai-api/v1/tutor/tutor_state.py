from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from v1.learner_model import (
    AdaptiveStrategy,
    ConceptMastery,
    HintPolicy,
    LearnerState,
    ScaffoldingLevel,
    StrategyName,
)
from v1.learner_model.misconception import TrackedMisconception


class TutorOutcomeStatus(str, Enum):
    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    REJECTED_OFF_TOPIC = "REJECTED_OFF_TOPIC"
    BLOCKED_BY_INJECTION = "BLOCKED_BY_INJECTION"
    ERROR = "ERROR"


@dataclass
class TutorRunState:
    trace_id: str
    learner_id: str
    lesson_id: str
    step_id: str
    topic_id: str
    session_id: str
    user_query: str
    acting_user_id: str
    tenant_id: str
    idempotency_key: str
    learner_state: Optional[LearnerState] = None
    adaptive_strategy: Optional[AdaptiveStrategy] = None
    relevant_memory: List[Dict[str, Any]] = field(default_factory=list)
    rag_evidence: List[Dict[str, Any]] = field(default_factory=list)
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)
    domain_ontology_block: str = ""
    accounting_context: Dict[str, Any] = field(default_factory=dict)
    response_text: str = ""
    status: TutorOutcomeStatus = TutorOutcomeStatus.SUCCESS
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

    def elapsed_ms(self) -> Optional[int]:
        if self.completed_at is None:
            return None
        return int((self.completed_at - self.started_at).total_seconds() * 1000)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "traceId": self.trace_id,
            "learnerId": self.learner_id,
            "lessonId": self.lesson_id,
            "stepId": self.step_id,
            "topicId": self.topic_id,
            "sessionId": self.session_id,
            "userQuery": self.user_query,
            "actingUserId": self.acting_user_id,
            "tenantId": self.tenant_id,
            "idempotencyKey": self.idempotency_key,
            "learnerStateVersion": (
                self.learner_state.state_version if self.learner_state else None
            ),
            "adaptiveStrategy": (
                self.adaptive_strategy.to_dict() if self.adaptive_strategy else None
            ),
            "relevantMemory": list(self.relevant_memory),
            "ragEvidence": list(self.rag_evidence),
            "toolCalls": list(self.tool_calls),
            "response": self.response_text,
            "status": self.status.value,
            "elapsedMs": self.elapsed_ms(),
        }


__all__ = ["TutorOutcomeStatus", "TutorRunState"]