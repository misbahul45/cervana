from __future__ import annotations

import logging

from celery.exceptions import Reject

from config.agent_session import AgentSession, session_payload_is_safe
from config.celery import celery_app
from v1.decision_traces.dto import DecisionTraceCreate
from v1.decision_traces.service import sha256_hex, write_decision_trace
from v1.episodes.dto import EpisodeCreate
from v1.episodes.service import write_episode
from v1.users_steps.generate_quiz_pipeline import graph
from v1.users_steps.service import create_personality_quiz


logger = logging.getLogger(__name__)


def _session_from_payload(payload: dict) -> AgentSession:
    return AgentSession(
        session_id=payload["session_id"],
        acting_user_id=payload["acting_user_id"],
        tenant_id=payload["tenant_id"],
        trace_id=payload["trace_id"],
        idempotency_key=payload["idempotency_key"],
        issued_at_ms=0,
    )


def _reject_if_unsafe(payload: dict) -> None:
    if not session_payload_is_safe(payload):
        logger.error("[CELERY] refusing to dispatch task with bearer-shaped fields")
        raise Reject("bearer-shaped fields in celery payload", requeue=False)


@celery_app.task(
    name="v1.user_steps.generate_personality_quiz",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
)
def generate_personality_quiz(self, initial_state: dict):
    _reject_if_unsafe(initial_state)
    session = _session_from_payload(initial_state)
    result = graph.invoke(initial_state)

    quiz_items = result.get("quiz", [])

    questions = [
        {
            "question": q.question,
            "type": q.type,
            "difficulty": q.difficulty,
            "options": q.options,
            "answer": q.answer,
        }
        for q in quiz_items
    ]

    create_personality_quiz(
        payload={
            "userId": session.acting_user_id,
            "lessonId": initial_state["lessonId"],
            "title": "AI Generated Personality Quiz",
            "questions": questions,
            "userAttempt": "JSON_NULL",
            "result": "JSON_NULL",
            "takenAt": None,
        },
        session=session,
    )

    try:
        write_episode(
            EpisodeCreate(
                trace_id=session.trace_id,
                session_id=session.session_id,
                acting_user_id=session.acting_user_id,
                tenant_id=session.tenant_id,
                idempotency_key=session.idempotency_key,
                agent="personality_quiz_agent",
                intent="personality_quiz",
                lesson_id=initial_state.get("lessonId"),
                user_id=session.acting_user_id,
                task="generate-personality-quiz",
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
                agent_name="personality_quiz_agent",
                agent_scope="generate-personality-quiz",
                prompt_hash=sha256_hex(
                    f"quiz|{initial_state.get('lessonId')}|{session.session_id}"
                ),
                tool_calls=[{"name": "structured_output", "schema": "QuizResponse"}],
                deterministic_outputs={
                    "question_count": len(questions),
                    "lesson_id": initial_state.get("lessonId"),
                },
                reason_codes=["PHASE_1_FOUNDATION"],
            ),
            session=session,
        )
    except Exception as exc:
        logger.error("[DECISION_TRACE] write failed: %s", exc)

    return questions


__all__ = ["generate_personality_quiz"]