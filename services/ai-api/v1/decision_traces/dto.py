from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


class DecisionTraceCreate(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )

    trace_id: str
    session_id: str
    acting_user_id: str
    tenant_id: str
    idempotency_key: str

    agent_name: str
    agent_scope: str

    prompt_hash: str
    response_hash: Optional[str] = None

    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)
    deterministic_outputs: Dict[str, Any] = Field(default_factory=dict)

    policy_version: str = "unknown-v0"
    prompt_version: str = "unknown-v0"

    reason_codes: List[str] = Field(default_factory=list)
    selected_action: Optional[str] = None

    metadata: Dict[str, Any] = Field(default_factory=dict)


__all__ = ["DecisionTraceCreate"]