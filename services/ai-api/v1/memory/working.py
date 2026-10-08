from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass
class WorkingMemory:
    session_id: str
    learner_id: str
    intent: str = ""
    scratchpad: Dict[str, Any] = field(default_factory=dict)
    current_step: Optional[str] = None
    open_questions: List[str] = field(default_factory=list)
    pending_tools: List[str] = field(default_factory=list)
    temporary_assumptions: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def update(self, **fields: Any) -> "WorkingMemory":
        for key, value in fields.items():
            if not hasattr(self, key):
                raise AttributeError(f"WorkingMemory has no field {key!r}")
            setattr(self, key, value)
        self.updated_at = datetime.now(timezone.utc)
        return self

    def reset(self) -> "WorkingMemory":
        self.scratchpad.clear()
        self.open_questions.clear()
        self.pending_tools.clear()
        self.temporary_assumptions.clear()
        self.updated_at = datetime.now(timezone.utc)
        return self

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sessionId": self.session_id,
            "learnerId": self.learner_id,
            "intent": self.intent,
            "scratchpad": dict(self.scratchpad),
            "currentStep": self.current_step,
            "openQuestions": list(self.open_questions),
            "pendingTools": list(self.pending_tools),
            "temporaryAssumptions": list(self.temporary_assumptions),
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
        }


__all__ = ["WorkingMemory"]