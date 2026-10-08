from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class RewardKind(str, Enum):
    XP = "XP"
    STREAK = "STREAK"
    BADGE = "BADGE"
    LEADERBOARD_RANK = "LEADERBOARD_RANK"
    THEME_UNLOCK = "THEME_UNLOCK"


class RewardReason(str, Enum):
    MASTERY_MILESTONE = "MASTERY_MILESTONE"
    VALIDATED_PRACTICE = "VALIDATED_PRACTICE"
    SCENARIO_SUCCESS = "SCENARIO_SUCCESS"
    KNOWLEDGE_CONTRIBUTION = "KNOWLEDGE_CONTRIBUTION"
    LEARNING_MILESTONE = "LEARNING_MILESTONE"
    REJECT_DUPLICATE = "REJECT_DUPLICATE"
    REJECT_REPLAY = "REJECT_REPLAY"
    REJECT_TOO_FAST = "REJECT_TOO_FAST"
    REJECT_LOGIN = "REJECT_LOGIN"
    REJECT_CHAT = "REJECT_CHAT"
    REJECT_NO_VALID_EVENT = "REJECT_NO_VALID_EVENT"


class RewardSource(str, Enum):
    MASTERY_CHANGE = "MASTERY_CHANGE"
    SCENARIO_OUTCOME = "SCENARIO_OUTCOME"
    LEARNING_MILESTONE = "LEARNING_MILESTONE"
    CREATOR_OUTCOME = "CREATOR_OUTCOME"


@dataclass(frozen=True)
class RewardEvent:
    event_id: str
    user_id: str
    source: RewardSource
    reward_kind: RewardKind
    amount: int
    rule_id: str
    rule_version: str
    idempotency_key: str
    occurred_at: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.amount < 0:
            raise ValueError(f"reward amount must be non-negative, got {self.amount}")
        if not self.idempotency_key:
            raise ValueError("idempotency_key is required")


@dataclass(frozen=True)
class RewardDecision:
    eligible: bool
    reward_kind: RewardKind
    amount: int
    rule_id: str
    rule_version: str
    reason: RewardReason
    idempotency_key: str
    explanation: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "eligible": self.eligible,
            "rewardKind": self.reward_kind.value,
            "amount": self.amount,
            "ruleId": self.rule_id,
            "ruleVersion": self.rule_version,
            "reason": self.reason.value,
            "idempotencyKey": self.idempotency_key,
            "explanation": self.explanation,
        }


@dataclass(frozen=True)
class LedgerEntry:
    entry_id: str
    user_id: str
    kind: RewardKind
    delta: int
    rule_id: str
    rule_version: str
    event_id: str
    idempotency_key: str
    created_at: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)


__all__ = [
    "RewardKind",
    "RewardReason",
    "RewardSource",
    "RewardEvent",
    "RewardDecision",
    "LedgerEntry",
]