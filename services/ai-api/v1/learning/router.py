from __future__ import annotations

import logging

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from pydantic import ValidationError

from config.agent_session import AgentSession, mint_session
from config.logging_config import configure_logging
from config.rate_limit import rate_limit
from config.trace_context import current_trace_id
from config.user_auth import authenticated_user, bind_acting_user
from errors.envelope import error_envelope
from errors.types import AuthError, CrossServiceError
from middleware.idempotency import require_idempotency_key
from v1.learning.dto import GenerateContentMaterialPipeline
from v1.learning.workers import (
    generate_content_material_task,
    generating_new_content,
)


configure_logging()
router = APIRouter(prefix="/learning", tags=["Learning"])
logger = logging.getLogger(__name__)


def _resolve_session(request: Request, body: dict, idempotency_key: str, user: dict) -> AgentSession:
    acting_user_id = bind_acting_user(user, body.get("userId") or body.get("user_id"))
    return mint_session(
        acting_user_id=acting_user_id,
        trace_id=getattr(request.state, "trace_id", None),
        idempotency_key=idempotency_key,
    )


def _session_dict(session: AgentSession) -> dict:
    return session.to_dict()


@router.post("/generate-material")
@rate_limit(capacity_per_minute=30, burst=5)
@require_idempotency_key(mint_if_missing=False)
async def generate_learning_content(
    request: Request,
    body: dict = Body(..., description="Request body for generating learning content"),
    user: dict = Depends(authenticated_user),
):
    idempotency_key = getattr(request.state, "idempotency_key", None)
    if not idempotency_key:
        raise AuthError(
            "Idempotency-Key missing after decorator",
            details={"requestId": current_trace_id()},
        )
    session = _resolve_session(request, body, idempotency_key, user)
    try:
        state = GenerateContentMaterialPipeline(
            user_id=session.acting_user_id,
            step_id=body["stepId"],
            user_step_id=body["userStepId"],
            topic_id=body["topicId"],
            lesson_id=body["lessonId"],
            learning_style_id=body.get("learningStyleId", ""),
            message_id=body["messageId"],
            chat_id=body["chatId"],
            session_id=session.session_id,
            acting_user_id=session.acting_user_id,
            tenant_id=session.tenant_id,
            trace_id=session.trace_id,
            idempotency_key=session.idempotency_key,
        )
    except (ValidationError, KeyError) as exc:
        logger.error("Validation error building pipeline state: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    payload = state.model_dump()
    payload.update(session.__dict__)
    payload = {k: v for k, v in payload.items() if k != "generate"}
    try:
        task = generate_content_material_task.delay(payload)
    except Exception as exc:
        logger.error("Failed to dispatch generate_content_material: %s", exc)
        raise CrossServiceError(
            "failed to dispatch task",
            details={"requestId": current_trace_id(), "error": str(exc)},
        ) from exc

    return {
        "status": "processing",
        "task_id": task.id,
        "session_id": session.session_id,
        "trace_id": session.trace_id,
        "idempotency_key": session.idempotency_key,
        "message": "Content generation started",
    }


@router.post("/chat")
@rate_limit(capacity_per_minute=60, burst=10)
@require_idempotency_key(mint_if_missing=False)
async def chat(
    request: Request,
    body: dict = Body(..., description="Request body for chat continuation"),
    user: dict = Depends(authenticated_user),
):
    idempotency_key = getattr(request.state, "idempotency_key", None)
    if not idempotency_key:
        raise AuthError(
            "Idempotency-Key missing after decorator",
            details={"requestId": current_trace_id()},
        )
    session = _resolve_session(request, body, idempotency_key, user)
    payload = {
        "chatId": body.get("chatId", ""),
        "userStepId": body.get("userStepId", ""),
        "messageId": body.get("messageId", ""),
        "userId": session.acting_user_id,
        "query": body.get("query", ""),
        **session.to_dict(),
    }
    try:
        task = generating_new_content.delay(payload)
    except Exception as exc:
        logger.error("Failed to dispatch generating_new_content: %s", exc)
        raise CrossServiceError(
            "failed to dispatch task",
            details={"requestId": current_trace_id(), "error": str(exc)},
        ) from exc

    return {
        "status": "processing",
        "task_id": task.id,
        "session_id": session.session_id,
        "trace_id": session.trace_id,
        "idempotency_key": session.idempotency_key,
        "message": "Content generation started",
    }


__all__ = ["router"]