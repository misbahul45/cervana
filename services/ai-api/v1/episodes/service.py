from __future__ import annotations

import logging
from typing import Any

import requests

from config.agent_session import AgentSession
from config.envs import ENVS
from errors.types import CrossServiceError
from v1.episodes.dto import EpisodeCreate, EpisodeCitation


logger = logging.getLogger(__name__)


_INTERNAL_EPISODES_PATH = "/internal/episodes"


def _payload_has_bearer(payload: dict) -> bool:
    forbidden = {"token", "bearer", "authorization", "password", "secret"}
    return bool({k.lower() for k in payload.keys()} & forbidden)


def write_episode(
    episode: EpisodeCreate,
    *,
    session: AgentSession,
) -> int:
    if _payload_has_bearer(episode.model_dump(by_alias=True)):
        raise ValueError("episode payload contains forbidden bearer-shaped keys")

    url = f"{ENVS['NEST_API']}{_INTERNAL_EPISODES_PATH}"
    body = episode.model_dump(by_alias=True)
    headers = {
        "x-acting-user-id": session.acting_user_id,
        "x-trace-id": session.trace_id,
        "x-idempotency-key": session.idempotency_key,
        "x-service-id": "ai-api",
        "Content-Type": "application/json",
    }

    logger.info(
        "[EPISODE][POST] %s trace=%s agent=%s status=%s",
        url,
        session.trace_id,
        episode.agent,
        episode.status,
    )

    try:
        response = requests.post(url, json=body, headers=headers, timeout=10)
    except requests.RequestException as exc:
        logger.error("[EPISODE] network failure: %s", exc)
        raise CrossServiceError(
            "failed to post episode",
            details={"url": url, "error": str(exc), "trace_id": session.trace_id},
        ) from exc

    if response.status_code >= 500:
        logger.error("[EPISODE] upstream 5xx status=%s", response.status_code)
        raise CrossServiceError(
            "internal api error writing episode",
            details={"url": url, "status": response.status_code, "trace_id": session.trace_id},
        )

    if response.status_code >= 400:
        logger.error("[EPISODE] upstream 4xx status=%s body=%s", response.status_code, response.text[:200])
        raise CrossServiceError(
            "internal api rejected episode",
            details={
                "url": url,
                "status": response.status_code,
                "trace_id": session.trace_id,
                "body": response.text[:500],
            },
        )

    return response.status_code


__all__ = ["write_episode", "EpisodeCreate", "EpisodeCitation"]