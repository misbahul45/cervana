from __future__ import annotations


from config.agent_session import mint_session
from v1.decision_traces.dto import DecisionTraceCreate

API_DECISION_TRACE_KEYS = {
    "trace_id",
    "session_id",
    "acting_user_id",
    "tenant_id",
    "idempotency_key",
    "agent_name",
    "agent_scope",
    "prompt_hash",
    "response_hash",
    "tool_calls",
    "deterministic_outputs",
    "policy_version",
    "prompt_version",
    "reason_codes",
    "selected_action",
    "metadata",
}


def test_write_decision_trace_posts_a_signed_request_with_the_trace_id(internal_wire):
    from v1.decision_traces import service as traces_service

    internal_wire.respond(201, {"data": {"id": "d-1"}})
    session = mint_session(acting_user_id="u-1", trace_id="trace-abc", idempotency_key="k-1")
    decision = DecisionTraceCreate(
        trace_id=session.trace_id,
        session_id=session.session_id,
        acting_user_id=session.acting_user_id,
        tenant_id=session.tenant_id,
        idempotency_key=session.idempotency_key,
        agent_name="tutor_agent",
        agent_scope="generate-material",
        prompt_hash=traces_service.sha256_hex("payload"),
    )

    traces_service.write_decision_trace(decision, session=session)

    prepared = internal_wire.sent[0]
    body = internal_wire.json_of(prepared)
    assert prepared.url.endswith("/internal/decision-traces")
    assert prepared.headers["x-service-signature"]
    assert prepared.headers["x-trace-id"] == "trace-abc"
    assert prepared.headers["x-acting-user-id"] == "u-1"
    assert "Authorization" not in prepared.headers
    assert body["trace_id"] == "trace-abc"
    assert body["agent_name"] == "tutor_agent"
    assert set(body) <= API_DECISION_TRACE_KEYS


def test_write_decision_trace_raises_on_4xx(internal_wire):
    from v1.decision_traces import service as traces_service
    from errors.types import CrossServiceError

    internal_wire.respond(422, {"message": "bad request"})
    session = mint_session(acting_user_id="u-1", idempotency_key="k-2")
    decision = DecisionTraceCreate(
        trace_id=session.trace_id,
        session_id=session.session_id,
        acting_user_id=session.acting_user_id,
        tenant_id=session.tenant_id,
        idempotency_key=session.idempotency_key,
        agent_name="tutor_agent",
        agent_scope="chat",
        prompt_hash="h",
    )

    try:
        traces_service.write_decision_trace(decision, session=session)
    except CrossServiceError:
        return
    raise AssertionError("expected CrossServiceError on 4xx")


def test_write_decision_trace_rejects_bearer_shaped_payload():
    from v1.decision_traces import service as traces_service

    session = mint_session(acting_user_id="u-1", idempotency_key="k-3")
    decision = DecisionTraceCreate(
        trace_id=session.trace_id,
        session_id=session.session_id,
        acting_user_id=session.acting_user_id,
        tenant_id=session.tenant_id,
        idempotency_key=session.idempotency_key,
        agent_name="tutor_agent",
        agent_scope="chat",
        prompt_hash="h",
    )

    from unittest.mock import patch

    with patch.object(traces_service, "_payload_has_bearer", return_value=True):
        try:
            traces_service.write_decision_trace(decision, session=session)
        except ValueError:
            return
    raise AssertionError("expected ValueError on bearer-shaped payload")