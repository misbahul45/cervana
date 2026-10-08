from __future__ import annotations

from unittest.mock import MagicMock, patch

from config.agent_session import mint_session
from v1.decision_traces.dto import DecisionTraceCreate


def test_write_decision_trace_posts_with_trace_id():
    from v1.decision_traces import service as traces_service

    sent = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        sent["url"] = url
        sent["json"] = json
        sent["headers"] = headers
        response = MagicMock()
        response.status_code = 201
        response.text = ""
        return response

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

    with patch("v1.decision_traces.service.requests.post", side_effect=fake_post):
        status = traces_service.write_decision_trace(decision, session=session)

    assert status == 201
    assert sent["url"].endswith("/internal/decision-traces")
    assert sent["headers"]["x-trace-id"] == "trace-abc"
    assert sent["headers"]["x-acting-user-id"] == "u-1"
    assert "Authorization" not in sent["headers"]
    assert sent["json"]["traceId"] == "trace-abc"
    assert sent["json"]["agentName"] == "tutor_agent"


def test_write_decision_trace_raises_on_4xx():
    from v1.decision_traces import service as traces_service
    from errors.types import CrossServiceError

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

    response = MagicMock()
    response.status_code = 422
    response.text = "bad request"

    with patch("v1.decision_traces.service.requests.post", return_value=response):
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