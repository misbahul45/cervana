from __future__ import annotations

import logging
from typing import Any

from config.agent_session import AgentSession
from v1.domain.adapter import fetch_learner_state, get_concept_catalog
from v1.tutor.personalization_prompt import render_learner_snapshot

logger = logging.getLogger(__name__)


def read_learner_snapshot(
    session: AgentSession,
    *,
    lesson_id: str | None = None,
    user_step_id: str | None = None,
) -> dict[str, Any] | None:
    ids = {key: value for key, value in (("lesson_id", lesson_id), ("user_step_id", user_step_id)) if value}
    if not ids:
        return None
    try:
        return fetch_learner_state(session, **ids)
    except Exception:
        logger.warning("[LEARNER_STATE] read failed, the prompt is built without it", exc_info=True)
        return None


def render_snapshot_block(session: AgentSession, snapshot: dict[str, Any] | None) -> str:
    if not snapshot:
        return ""

    catalog = get_concept_catalog()
    try:
        catalog.load(session)
    except Exception:
        logger.warning("[LEARNER_STATE] concept registry unavailable, domain ids are left out", exc_info=True)

    try:
        return render_learner_snapshot(snapshot, catalog)
    except Exception:
        logger.warning("[LEARNER_STATE] snapshot could not be rendered, it is left out", exc_info=True)
        return ""


def learner_snapshot_block(
    session: AgentSession,
    *,
    lesson_id: str | None = None,
    user_step_id: str | None = None,
) -> str:
    return render_snapshot_block(session, read_learner_snapshot(session, lesson_id=lesson_id, user_step_id=user_step_id))


__all__ = ["learner_snapshot_block", "read_learner_snapshot", "render_snapshot_block"]
