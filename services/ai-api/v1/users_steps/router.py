from __future__ import annotations

import logging

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from config.agent_session import AgentSession, mint_session
from config.embedding_pipeline import get_embedding_pipeline
from config.logging_config import configure_logging
from config.rate_limit import rate_limit
from config.trace_context import current_trace_id
from config.user_auth import authenticated_user, bind_acting_user
from errors.envelope import error_envelope
from errors.types import AuthError
from middleware.idempotency import require_idempotency_key
from v1.users_steps.dto import LPState
from v1.users_steps.generate_user_steps_pipeline import generate_user_steps_pipeline
from v1.users_steps.service import get_learning_style, get_steps
from v1.users_steps.workers import generate_personality_quiz


configure_logging()
router = APIRouter(prefix="/users-steps", tags=["User-Steps"])
pipeline = get_embedding_pipeline()
logger = logging.getLogger(__name__)


def _resolve_session(request: Request, body: dict, idempotency_key: str, user: dict) -> AgentSession:
    acting_user_id = bind_acting_user(user, body.get("userId") or body.get("user_id"))
    return mint_session(
        acting_user_id=acting_user_id,
        trace_id=getattr(request.state, "trace_id", None),
        idempotency_key=idempotency_key,
    )


@router.get("/generate-question")
@rate_limit(capacity_per_minute=30, burst=5)
@require_idempotency_key(mint_if_missing=False)
async def generate_question_sse(
    request: Request,
    lessonId: str,
    topicId: str,
    learningStyleId: str,
    userId: str,
    user: dict = Depends(authenticated_user),
):
    idempotency_key = getattr(request.state, "idempotency_key", None)
    if not idempotency_key:
        raise AuthError(
            "Idempotency-Key missing after decorator",
            details={"requestId": current_trace_id()},
        )

    session = mint_session(
        acting_user_id=bind_acting_user(user, userId),
        trace_id=getattr(request.state, "trace_id", None),
        idempotency_key=idempotency_key,
    )

    payload = {
        "userId": userId,
        "lessonId": lessonId,
        "topicId": topicId,
        "learningStyleId": learningStyleId,
        **session.to_dict(),
    }

    generate_personality_quiz.delay(payload)

    try:
        steps = get_steps(lessonId, session)
        learning_style = get_learning_style(learningStyleId, session)
    except Exception as exc:
        logger.error("[SSE] upstream fetch failed: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    async def event_stream():
        try:
            yield {"event": "status", "data": "Generating introduction..."}

            from v1.users_steps.service import build_learning_introduction_llm

            intro_chunks = []
            async for chunk in build_learning_introduction_llm(
                steps,
                pipeline,
                learning_style=learning_style,
                session=session,
            ):
                if hasattr(chunk, "delta") and chunk.delta:
                    text = chunk.delta
                elif hasattr(chunk, "text") and chunk.text:
                    text = chunk.text
                elif hasattr(chunk, "content") and chunk.content:
                    text = chunk.content
                else:
                    text = chunk

                if callable(text):
                    text = text()

                if text is None:
                    continue
                if not isinstance(text, str):
                    text = str(text)
                text = text.strip()
                if not text:
                    continue
                intro_chunks.append(text)
                yield {"event": "introduction_chunk", "data": text}

            introduction = "".join(intro_chunks)
            yield {"event": "end", "data": introduction}

        except Exception as exc:
            logger.exception("[SSE] stream error")
            yield {"event": "error", "data": error_envelope(exc)}

    return EventSourceResponse(event_stream())


@router.post("/generate")
@rate_limit(capacity_per_minute=30, burst=5)
@require_idempotency_key(mint_if_missing=False)
async def generate_user_steps(
    request: Request,
    payload: dict = Body(...),
    user: dict = Depends(authenticated_user),
):
    idempotency_key = getattr(request.state, "idempotency_key", None)
    if not idempotency_key:
        raise AuthError(
            "Idempotency-Key missing after decorator",
            details={"requestId": current_trace_id()},
        )

    session = _resolve_session(request, payload, idempotency_key, user)

    pipeline_input = LPState(
        user_id=session.acting_user_id,
        target_step_id=payload["targetStepId"],
        topic_id=payload["topicId"],
        lesson_id=payload["lessonId"],
        learning_style_id=payload.get("learningStyleId", ""),
        session_id=session.session_id,
        acting_user_id=session.acting_user_id,
        tenant_id=session.tenant_id,
        trace_id=session.trace_id,
        idempotency_key=session.idempotency_key,
    )

    try:
        output = generate_user_steps_pipeline.invoke(pipeline_input.model_dump())
        state = LPState.model_validate(output)
        if state.error:
            logger.error("Generation failed: %s", state.error)
            return {"error": state.error}
        return state.generated.data if state.generated else []
    except Exception as exc:
        logger.exception("Pipeline execution error")
        return {"error": "Internal pipeline error"}


__all__ = ["router"]