from __future__ import annotations

import hashlib
import time
import uuid
from dataclasses import dataclass, asdict


@dataclass(frozen=True)
class AgentSession:
    session_id: str
    acting_user_id: str
    tenant_id: str
    trace_id: str
    idempotency_key: str
    issued_at_ms: int

    def to_dict(self) -> dict:
        return asdict(self)


def _derive_tenant(acting_user_id: str) -> str:
    return hashlib.sha256(acting_user_id.encode("utf-8")).hexdigest()[:16]


def mint_session(
    *,
    acting_user_id: str,
    trace_id: str | None = None,
    idempotency_key: str | None = None,
) -> AgentSession:
    if not acting_user_id:
        raise ValueError("acting_user_id is required to mint a session")
    return AgentSession(
        session_id=str(uuid.uuid4()),
        acting_user_id=acting_user_id,
        tenant_id=_derive_tenant(acting_user_id),
        trace_id=trace_id or str(uuid.uuid4()),
        idempotency_key=idempotency_key or str(uuid.uuid4()),
        issued_at_ms=int(time.time() * 1000),
    )


def session_from_dict(payload: dict) -> AgentSession:
    return AgentSession(
        session_id=payload["session_id"],
        acting_user_id=payload["acting_user_id"],
        tenant_id=payload["tenant_id"],
        trace_id=payload["trace_id"],
        idempotency_key=payload["idempotency_key"],
        issued_at_ms=int(payload["issued_at_ms"]),
    )


def session_payload_is_safe(payload: dict) -> bool:
    forbidden = {"token", "bearer", "authorization", "password", "secret"}
    lowered = {k.lower() for k in payload.keys()}
    return not (lowered & forbidden)