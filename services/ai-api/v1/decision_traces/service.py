from __future__ import annotations

import hashlib
import logging
from typing import Any

import requests

from config.agent_session import AgentSession
from config.envs import ENVS
from errors.types import CrossServiceError
from v1.decision_traces.dto import DecisionTraceCreate


logger = logging.getLogger(__name__)


_INTERNAL_DECISION_TRACE_PATH = "/internal/decision-traces"


def _payload_has_bearer(payload: dict) -> bool:
    forbidden = {"token", "bearer", "authorization", "password", "secret"}
    return bool({k.lower() for k in payload.keys()} & forbidden)


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def write_decision_trace(
    decision: DecisionTraceCreate,
    *,
    session: AgentSession,
) -> int:
    if _payload_has_bearer(decision.model_dump(by_alias=True)):
        raise ValueError("decision-trace payload contains forbidden bearer-shaped keys")

    url = f"{ENVS['NEST_API']}{_INTERNAL_DECISION_TRACE_PATH}"
    body = decision.model_dump(by_alias=True)
    headers = {
        "x-acting-user-id": session.acting_user_id,
        "x-trace-id": session.trace_id,
        "x-idempotency-key": session.idempotency_key,
        "x-service-id": "ai-api",
        "Content-Type": "application/json",
    }

    logger.info(
        "[DECISION_TRACE][POST] %s trace=%s agent=%s scope=%s",
        url,
        session.trace_id,
        decision.agent_name,
        decision.agent_scope,
    )

    try:
        response = requests.post(url, json=body, headers=headers, timeout=10)
    except requests.RequestException as exc:
        logger.error("[DECISION_TRACE] network failure: %s", exc)
        raise CrossServiceError(
            "failed to post decision trace",
            details={"url": url, "error": str(exc), "trace_id": session.trace_id},
        ) from exc

    if response.status_code >= 400:
        logger.error(
            "[DECISION_TRACE] upstream rejected status=%s body=%s",
            response.status_code,
            response.text[:200],
        )
        raise CrossServiceError(
            "internal api rejected decision trace",
            details={
                "url": url,
                "status": response.status_code,
                "trace_id": session.trace_id,
                "body": response.text[:500],
            },
        )

    return response.status_code


__all__ = ["write_decision_trace", "sha256_hex", "DecisionTraceCreate"]