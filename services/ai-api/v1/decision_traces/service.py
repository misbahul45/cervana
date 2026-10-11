from __future__ import annotations

import hashlib
import logging

from config.agent_session import AgentSession
from config.internal_client import InternalApiClient
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
) -> None:
    if _payload_has_bearer(decision.model_dump(by_alias=True)):
        raise ValueError("decision-trace payload contains forbidden bearer-shaped keys")

    logger.info(
        "[DECISION_TRACE][POST] trace=%s agent=%s scope=%s",
        session.trace_id,
        decision.agent_name,
        decision.agent_scope,
    )

    InternalApiClient(session).send(
        "POST",
        _INTERNAL_DECISION_TRACE_PATH,
        json_body=decision.model_dump(mode="json", exclude_none=True),
    )


__all__ = ["write_decision_trace", "sha256_hex", "DecisionTraceCreate"]