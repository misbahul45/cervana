from __future__ import annotations

from unittest.mock import patch

from config.agent_session import mint_session
from v1.episodes.dto import EpisodeCitation, EpisodeCreate

API_EPISODE_KEYS = {
    "trace_id",
    "session_id",
    "acting_user_id",
    "tenant_id",
    "idempotency_key",
    "agent",
    "intent",
    "lesson_id",
    "step_id",
    "topic_id",
    "sub_topic_id",
    "user_id",
    "task",
    "response_excerpt",
    "citations",
    "decision_trace_ref",
    "tokens_in",
    "tokens_out",
    "cost_usd",
    "latency_ms",
    "prompt_version",
    "policy_version",
    "model",
    "retrieval_version",
    "status",
    "error",
    "metadata",
}
API_CITATION_KEYS = {"lessonId", "chunkId", "score", "source"}


def test_write_episode_posts_a_signed_request_to_the_internal_api(internal_wire):
    from v1.episodes import service as episodes_service

    internal_wire.respond(201, {"data": {"id": "e-1"}})
    session = mint_session(acting_user_id="u-1", idempotency_key="k-1")
    episode = EpisodeCreate(
        trace_id=session.trace_id,
        session_id=session.session_id,
        acting_user_id=session.acting_user_id,
        tenant_id=session.tenant_id,
        idempotency_key=session.idempotency_key,
        agent="tutor_agent",
        intent="tutor",
        task="generate-material",
        response_excerpt="hello",
    )

    episodes_service.write_episode(episode, session=session)

    prepared = internal_wire.sent[0]
    assert prepared.method == "POST"
    assert prepared.url.endswith("/internal/episodes")
    assert prepared.headers["x-service-signature"]
    assert prepared.headers["x-service-timestamp"]
    assert prepared.headers["x-acting-user-id"] == "u-1"
    assert prepared.headers["x-trace-id"] == session.trace_id
    assert prepared.headers["Idempotency-Key"] == prepared.headers["x-idempotency-key"]
    assert "Authorization" not in prepared.headers
    assert "token" not in internal_wire.json_of(prepared)


def test_the_episode_body_uses_only_the_fields_of_the_api_contract(internal_wire):
    from v1.episodes import service as episodes_service

    internal_wire.respond(201, {"data": {"id": "e-1"}})
    session = mint_session(acting_user_id="u-1", idempotency_key="k-9")
    episode = EpisodeCreate(
        trace_id=session.trace_id,
        session_id=session.session_id,
        acting_user_id=session.acting_user_id,
        tenant_id=session.tenant_id,
        idempotency_key=session.idempotency_key,
        agent="tutor_agent",
        intent="tutor",
        lesson_id="l-1",
        tokens_in=10,
        citations=[EpisodeCitation(lesson_id="l-1", chunk_id="3", score=0.9, source="material")],
    )

    episodes_service.write_episode(episode, session=session)

    body = internal_wire.json_of(internal_wire.sent[0])
    assert set(body) <= API_EPISODE_KEYS
    assert "created_at" not in body and "createdAt" not in body
    assert None not in body.values()
    assert body["lesson_id"] == "l-1"
    assert body["citations"] == [{"lessonId": "l-1", "chunkId": "3", "score": 0.9, "source": "material"}]
    assert set(body["citations"][0]) <= API_CITATION_KEYS


def test_write_episode_rejects_bearer_shaped_payload():
    from v1.episodes import service as episodes_service

    session = mint_session(acting_user_id="u-1", idempotency_key="k-2")
    episode = EpisodeCreate(
        trace_id=session.trace_id,
        session_id=session.session_id,
        acting_user_id=session.acting_user_id,
        tenant_id=session.tenant_id,
        idempotency_key=session.idempotency_key,
        agent="tutor_agent",
        intent="tutor",
    )

    from unittest.mock import patch

    def fake_check_bearer(payload):
        return True

    with patch.object(episodes_service, "_payload_has_bearer", side_effect=fake_check_bearer):
        try:
            episodes_service.write_episode(episode, session=session)
        except ValueError:
            return
    raise AssertionError("expected ValueError when payload contains bearer-shaped keys")


def test_write_episode_raises_on_5xx(internal_wire):
    from v1.episodes import service as episodes_service
    from errors.types import CrossServiceError

    internal_wire.respond(500, {"message": "boom"})
    session = mint_session(acting_user_id="u-1", idempotency_key="k-3")
    episode = EpisodeCreate(
        trace_id=session.trace_id,
        session_id=session.session_id,
        acting_user_id=session.acting_user_id,
        tenant_id=session.tenant_id,
        idempotency_key=session.idempotency_key,
        agent="tutor_agent",
        intent="tutor",
    )

    try:
        episodes_service.write_episode(episode, session=session)
    except CrossServiceError:
        return
    raise AssertionError("expected CrossServiceError on 5xx")
