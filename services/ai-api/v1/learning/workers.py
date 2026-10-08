from __future__ import annotations

import logging

from celery.exceptions import Reject

from config.agent_session import AgentSession, session_payload_is_safe
from config.celery import celery_app
from config.embedding_pipeline import get_embedding_pipeline
from config.model_router import get_router
from errors.types import CrossServiceError, LLMError
from v1.decision_traces.dto import DecisionTraceCreate
from v1.decision_traces.service import sha256_hex, write_decision_trace
from v1.episodes.dto import EpisodeCitation, EpisodeCreate
from v1.episodes.service import write_episode
from v1.learning.content_pipeline import generate_content_material_pipeline
from v1.learning.dto import GenerateContentMaterialPipeline
from v1.learning.service import create_content_material, update_message_chat


logger = logging.getLogger(__name__)
pipeline = get_embedding_pipeline()


def _reject_if_unsafe(payload: dict) -> None:
    if not session_payload_is_safe(payload):
        logger.error("[CELERY] refusing to dispatch task with bearer-shaped fields")
        raise Reject("bearer-shaped fields in celery payload", requeue=False)


CHAT_PAYLOAD_FIELDS = ("chatId", "userStepId", "messageId", "query")
CHAT_FAILURE_TEXT = "AI tidak dapat menghasilkan jawaban saat ini. Silakan coba lagi."


def _require_fields(payload: dict, fields: tuple[str, ...]) -> None:
    missing = [name for name in fields if not payload.get(name)]
    if missing:
        logger.error("[CELERY] payload is missing required fields: %s", ", ".join(missing))
        raise Reject(f"missing payload fields: {', '.join(missing)}", requeue=False)


def _session_from_payload(payload: dict) -> AgentSession:
    return AgentSession(
        session_id=payload["session_id"],
        acting_user_id=payload["acting_user_id"],
        tenant_id=payload["tenant_id"],
        trace_id=payload["trace_id"],
        idempotency_key=payload["idempotency_key"],
        issued_at_ms=0,
    )


def _session_from_state(state: GenerateContentMaterialPipeline) -> AgentSession:
    return AgentSession(
        session_id=state.session_id,
        acting_user_id=state.acting_user_id,
        tenant_id=state.tenant_id,
        trace_id=state.trace_id,
        idempotency_key=state.idempotency_key,
        issued_at_ms=0,
    )


@celery_app.task(
    name="v1.learning.generate_content_material",
    bind=True,
    autoretry_for=(Exception,),
    dont_autoretry_for=(Reject,),
    retry_backoff=True,
    max_retries=3,
)
def generate_content_material_task(self, payload: dict):
    _reject_if_unsafe(payload)
    try:
        logger.info("Celery Task Triggered: generate_content_material")
        state = GenerateContentMaterialPipeline(**payload)
        session = _session_from_state(state)
        result_state = generate_content_material_pipeline(state)
        content_generate = result_state.get("generate")
        if content_generate is None:
            raise CrossServiceError(
                "tutor pipeline produced no content",
                details={"trace_id": session.trace_id},
            )

        from v1.learning.dto import GenerateContentMaterialResponseDto

        try:
            validated = GenerateContentMaterialResponseDto.model_validate(content_generate)
            content_generate = validated.model_dump(by_alias=True, exclude_none=True)
        except Exception as exc:
            from errors.types import SchemaValidationError

            logger.error(
                "[WORKER] tutor response schema validation failed: %s", exc
            )
            raise SchemaValidationError(
                "worker received tutor response that does not match schema",
                details={"trace_id": session.trace_id, "error": str(exc)},
            ) from exc

        create_content_material(content_generate, session)
        logger.info("Content material generation completed successfully")

        try:
            citations = content_generate.get("citations") or []
            write_episode(
                EpisodeCreate(
                    trace_id=session.trace_id,
                    session_id=session.session_id,
                    acting_user_id=session.acting_user_id,
                    tenant_id=session.tenant_id,
                    idempotency_key=session.idempotency_key,
                    agent="tutor_agent",
                    intent="tutor",
                    lesson_id=state.lesson_id,
                    step_id=state.step_id,
                    topic_id=state.topic_id,
                    user_id=session.acting_user_id,
                    task="generate-material",
                    response_excerpt=(content_generate.get("data") or "")[:512],
                    citations=[
                        EpisodeCitation(
                            lesson_id=c.get("lessonId") or c.get("lesson_id"),
                            chunk_id=c.get("chunkId") or c.get("chunk_id"),
                            score=c.get("score"),
                            source=c.get("source"),
                        )
                        for c in citations
                        if isinstance(c, dict)
                    ],
                    tokens_in=None,
                    tokens_out=None,
                    cost_usd=None,
                    latency_ms=None,
                    status="completed",
                ),
                session=session,
            )
        except Exception as exc:
            logger.error("[EPISODE] write failed: %s", exc)

        try:
            write_decision_trace(
                DecisionTraceCreate(
                    trace_id=session.trace_id,
                    session_id=session.session_id,
                    acting_user_id=session.acting_user_id,
                    tenant_id=session.tenant_id,
                    idempotency_key=session.idempotency_key,
                    agent_name="tutor_agent",
                    agent_scope="generate-material",
                    prompt_hash=sha256_hex(
                        f"{state.lesson_id}|{state.step_id}|{state.topic_id}"
                    ),
                    response_hash=sha256_hex(content_generate.get("data") or ""),
                    tool_calls=[
                        {"name": "rag_retrieve", "lesson_id": state.lesson_id},
                        {"name": "web_search", "lesson_id": state.lesson_id},
                    ],
                    deterministic_outputs={
                        "lesson_id": state.lesson_id,
                        "step_id": state.step_id,
                        "topic_id": state.topic_id,
                        "citation_count": len(content_generate.get("citations") or []),
                    },
                    reason_codes=["PHASE_1_FOUNDATION"],
                ),
                session=session,
            )
        except Exception as exc:
            logger.error("[DECISION_TRACE] write failed: %s", exc)

        return {"message": "Success", "data": content_generate}
    except CrossServiceError as exc:
        logger.error("CrossServiceError in generate_content_material: %s", exc.message)
        raise exc
    except Exception as exc:
        logger.error("Error generating content material: %s", exc)
        raise exc


@celery_app.task(
    name="v1.learning.generate_new_content",
    bind=True,
    autoretry_for=(Exception,),
    dont_autoretry_for=(Reject,),
    retry_backoff=True,
    max_retries=3,
)
def generating_new_content(self, payload: dict):
    _reject_if_unsafe(payload)
    _require_fields(payload, CHAT_PAYLOAD_FIELDS)
    try:
        logger.info("Celery Task Triggered: generating_new_content")
        session = _session_from_payload(payload)
        query = payload["query"]
        user_step_id = payload["userStepId"]
        message_id = payload["messageId"]

        from v1.learning.service import get_propmpt_material

        pipeline.enable_thinking = False
        prompt = get_propmpt_material(query, message_id, user_step_id, session)
        try:
            routed = get_router().invoke(
                "tutor_reply",
                prompt,
                query=query,
                context_chars=len(prompt),
                subject=session.acting_user_id,
            )
            generated_content = routed.text
        except Exception as exc:
            logger.error("[generate_new_content] LLM call failed: %s", exc)
            update_message_chat(message_id, session, {"text": CHAT_FAILURE_TEXT, "status": "FAILED"})
            raise LLMError(
                "tutor chat generation failed",
                details={"trace_id": session.trace_id},
            ) from exc

        update_message_chat(
            message_id,
            session,
            {"text": f"Successfully generate continue material for {generated_content[:50]}", "status": "COMPLETED"},
        )
        logger.info("Content material generation completed successfully")

        try:
            write_episode(
                EpisodeCreate(
                    trace_id=session.trace_id,
                    session_id=session.session_id,
                    acting_user_id=session.acting_user_id,
                    tenant_id=session.tenant_id,
                    idempotency_key=session.idempotency_key,
                    agent="tutor_agent",
                    intent="chat",
                    user_id=session.acting_user_id,
                    task="continue-material",
                    response_excerpt=generated_content[:512],
                    status="completed",
                ),
                session=session,
            )
        except Exception as exc:
            logger.error("[EPISODE] write failed: %s", exc)

        try:
            write_decision_trace(
                DecisionTraceCreate(
                    trace_id=session.trace_id,
                    session_id=session.session_id,
                    acting_user_id=session.acting_user_id,
                    tenant_id=session.tenant_id,
                    idempotency_key=session.idempotency_key,
                    agent_name="tutor_agent",
                    agent_scope="chat-continuation",
                    prompt_hash=sha256_hex(f"chat|{user_step_id}|{session.session_id}"),
                    response_hash=sha256_hex(generated_content),
                    tool_calls=[
                        {"name": "rag_retrieve", "user_step_id": user_step_id},
                        {"name": "web_search", "user_step_id": user_step_id},
                    ],
                    deterministic_outputs={"user_step_id": user_step_id},
                    policy_version=routed.policy_version,
                    reason_codes=["PHASE_1_FOUNDATION"],
                    metadata={
                        "modelMode": routed.mode,
                        "escalated": routed.escalated,
                        "modelAttempts": len(routed.attempts),
                        "complexity": routed.complexity,
                    },
                ),
                session=session,
            )
        except Exception as exc:
            logger.error("[DECISION_TRACE] write failed: %s", exc)

        return {"message": "Success", "data": generated_content}
    except CrossServiceError as exc:
        logger.error("CrossServiceError in generating_new_content: %s", exc.message)
        raise exc
    except Exception as exc:
        logger.error("Error generating new content: %s", exc)
        raise exc


__all__ = [
    "generate_content_material_task",
    "generating_new_content",
]