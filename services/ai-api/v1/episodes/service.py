from __future__ import annotations

import logging

from config.agent_session import AgentSession
from config.internal_client import InternalApiClient
from v1.episodes.dto import EpisodeCreate, EpisodeCitation


logger = logging.getLogger(__name__)


_INTERNAL_EPISODES_PATH = "/internal/episodes"


def _payload_has_bearer(payload: dict) -> bool:
    forbidden = {"token", "bearer", "authorization", "password", "secret"}
    return bool({k.lower() for k in payload.keys()} & forbidden)


def _wire_body(episode: EpisodeCreate) -> dict:
    body = episode.model_dump(mode="json", exclude={"created_at", "citations"}, exclude_none=True)
    body["citations"] = [
        citation.model_dump(by_alias=True, mode="json", exclude_none=True)
        for citation in episode.citations
    ]
    return body


def write_episode(
    episode: EpisodeCreate,
    *,
    session: AgentSession,
) -> None:
    if _payload_has_bearer(episode.model_dump(by_alias=True)):
        raise ValueError("episode payload contains forbidden bearer-shaped keys")

    logger.info(
        "[EPISODE][POST] trace=%s agent=%s status=%s",
        session.trace_id,
        episode.agent,
        episode.status,
    )

    InternalApiClient(session).send("POST", _INTERNAL_EPISODES_PATH, json_body=_wire_body(episode))


__all__ = ["write_episode", "EpisodeCreate", "EpisodeCitation"]