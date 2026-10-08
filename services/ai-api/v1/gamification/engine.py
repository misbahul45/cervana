from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple


MIN_EVENT_INTERVAL_SECONDS = 5
MIN_SCENARIO_INTERVAL_SECONDS = 30


@dataclass
class RewardRule:
    rule_id: str
    rule_version: str
    reward_kind: str
    base_amount: int
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ruleId": self.rule_id,
            "ruleVersion": self.rule_version,
            "rewardKind": self.reward_kind,
            "baseAmount": self.base_amount,
            "description": self.description,
        }


class RewardEngineSimulator:
    """Mirror of the api-side RewardEngine for in-process idempotency / farming tests.

    The authoritative RewardEngine lives in services/api (per AGENTS.md).
    ai-api uses this simulator to assert that any reward-eligibility logic the AI
    proposes would be ACCEPTED or REJECTED the same way by the api-side engine.
    The simulator must NEVER be used to mint real rewards.
    """

    def __init__(
        self,
        *,
        idempotency_window_hours: int = 24,
        scenario_cooldown_seconds: int = MIN_SCENARIO_INTERVAL_SECONDS,
    ) -> None:
        if idempotency_window_hours <= 0:
            raise ValueError("idempotency_window_hours must be positive")
        if scenario_cooldown_seconds < 0:
            raise ValueError("scenario_cooldown_seconds must be non-negative")
        self.idempotency_window = timedelta(hours=idempotency_window_hours)
        self.scenario_cooldown = timedelta(seconds=scenario_cooldown_seconds)
        self._seen_keys: Dict[str, datetime] = {}
        self._last_scenario_completion: Dict[str, datetime] = {}

    def evaluate(
        self,
        *,
        idempotency_key: str,
        event_kind: str,
        rule_id: str,
        rule_version: str,
        reward_kind: str,
        amount: int,
        now: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        if amount < 0:
            return self._reject("REJECT_NO_VALID_EVENT", rule_id, rule_version, reward_kind, idempotency_key, "negative amount")

        reference_now = now or datetime.now(timezone.utc)

        if event_kind == "LOGIN":
            return self._reject(
                "REJECT_LOGIN", rule_id, rule_version, reward_kind, idempotency_key,
                "login events do not earn XP",
            )
        if event_kind == "CHAT":
            return self._reject(
                "REJECT_CHAT", rule_id, rule_version, reward_kind, idempotency_key,
                "chat messages do not earn XP",
            )

        if idempotency_key in self._seen_keys:
            first_seen = self._seen_keys[idempotency_key]
            if reference_now - first_seen <= self.idempotency_window:
                return self._reject(
                    "REJECT_DUPLICATE", rule_id, rule_version, reward_kind, idempotency_key,
                    "duplicate event within idempotency window",
                )

        if event_kind == "SCENARIO_SUCCESS":
            last = self._last_scenario_completion.get(rule_id)
            if last is not None and reference_now - last < self.scenario_cooldown:
                return self._reject(
                    "REJECT_REPLAY", rule_id, rule_version, reward_kind, idempotency_key,
                    "scenario completed within cooldown",
                )
            self._last_scenario_completion[rule_id] = reference_now

        self._seen_keys[idempotency_key] = reference_now
        return {
            "eligible": True,
            "rewardKind": reward_kind,
            "amount": amount,
            "ruleId": rule_id,
            "ruleVersion": rule_version,
            "reason": "ACCEPTED",
            "idempotencyKey": idempotency_key,
        }

    def _reject(
        self,
        reason: str,
        rule_id: str,
        rule_version: str,
        reward_kind: str,
        idempotency_key: str,
        explanation: str,
    ) -> Dict[str, Any]:
        return {
            "eligible": False,
            "rewardKind": reward_kind,
            "amount": 0,
            "ruleId": rule_id,
            "ruleVersion": rule_version,
            "reason": reason,
            "idempotencyKey": idempotency_key,
            "explanation": explanation,
        }


__all__ = [
    "RewardRule",
    "RewardEngineSimulator",
    "MIN_EVENT_INTERVAL_SECONDS",
    "MIN_SCENARIO_INTERVAL_SECONDS",
]