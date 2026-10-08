from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


class EpisodeCitation(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )

    lesson_id: str
    chunk_id: Optional[str] = None
    score: Optional[float] = None
    source: Optional[str] = None


class EpisodeCreate(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )

    trace_id: str
    session_id: str
    acting_user_id: str
    tenant_id: str
    idempotency_key: str

    agent: str
    intent: str

    lesson_id: Optional[str] = None
    step_id: Optional[str] = None
    topic_id: Optional[str] = None
    sub_topic_id: Optional[str] = None

    user_id: Optional[str] = None

    task: Optional[str] = None
    response_excerpt: Optional[str] = None

    citations: List[EpisodeCitation] = Field(default_factory=list)
    decision_trace_ref: Optional[str] = None

    tokens_in: Optional[int] = None
    tokens_out: Optional[int] = None
    cost_usd: Optional[float] = None
    latency_ms: Optional[int] = None

    prompt_version: str = "unknown-v0"
    policy_version: str = "unknown-v0"
    model: str = "unknown-v0"
    retrieval_version: str = "unknown-v0"

    status: str = "completed"
    error: Optional[str] = None

    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())


__all__ = ["EpisodeCreate", "EpisodeCitation"]