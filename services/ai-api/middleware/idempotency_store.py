from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

COMPLETED_TTL_SECONDS = 24 * 60 * 60
IN_FLIGHT_TTL_SECONDS = 10 * 60
KEY_PREFIX = "idempotency"
CLAIM_ATTEMPTS = 2


@dataclass(frozen=True)
class Claim:
    kind: str
    status_code: int | None = None
    body: Any = None


class IdempotencyStore:
    def __init__(
        self,
        redis_client,
        completed_ttl_seconds: int = COMPLETED_TTL_SECONDS,
        in_flight_ttl_seconds: int = IN_FLIGHT_TTL_SECONDS,
    ):
        self.redis = redis_client
        self.completed_ttl_seconds = completed_ttl_seconds
        self.in_flight_ttl_seconds = in_flight_ttl_seconds

    def claim(self, scope: str, fingerprint: str) -> Claim:
        name = self._name(scope)
        pending = json.dumps({"state": "in_flight", "fingerprint": fingerprint})
        try:
            for _ in range(CLAIM_ATTEMPTS):
                if self.redis.set(name, pending, nx=True, ex=self.in_flight_ttl_seconds):
                    return Claim("new")
                raw = self.redis.get(name)
                if raw is not None:
                    return self._describe(json.loads(raw), fingerprint)
        except Exception as exc:
            logger.warning("[IDEMPOTENCY] store unavailable, request proceeds untracked: %s", exc)
        return Claim("unavailable")

    def complete(
        self,
        scope: str,
        fingerprint: str,
        *,
        status_code: int | None,
        body: Any,
        replayable: bool = True,
    ) -> None:
        record = {
            "state": "done",
            "fingerprint": fingerprint,
            "replayable": replayable,
            "status_code": status_code,
            "body": body,
        }
        try:
            self.redis.set(self._name(scope), json.dumps(record), ex=self.completed_ttl_seconds)
        except Exception as exc:
            logger.warning("[IDEMPOTENCY] could not record the outcome: %s", exc)

    def release(self, scope: str) -> None:
        try:
            self.redis.delete(self._name(scope))
        except Exception as exc:
            logger.warning("[IDEMPOTENCY] could not release the claim: %s", exc)

    @staticmethod
    def _name(scope: str) -> str:
        return f"{KEY_PREFIX}:{scope}"

    @staticmethod
    def _describe(stored: dict, fingerprint: str) -> Claim:
        if stored["fingerprint"] != fingerprint:
            return Claim("mismatch")
        if stored["state"] == "in_flight":
            return Claim("in_flight")
        if stored.get("replayable"):
            return Claim("replay", stored["status_code"], stored["body"])
        return Claim("processed")


__all__ = ["Claim", "IdempotencyStore"]
