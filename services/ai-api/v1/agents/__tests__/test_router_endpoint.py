import asyncio
from unittest.mock import patch, MagicMock
import pytest


CALLER = {"id": "u1", "role": "STUDENT"}


def _fake_request(idempotency_key: str):
    request = MagicMock()
    request.headers.get = lambda key, default=None: {"Idempotency-Key": idempotency_key}.get(key, default)
    request.state.bearer_token = "test-token"
    return request


@pytest.fixture(autouse=True)
def _default_mocks():
    with patch("v1.agents.router_endpoint.dispatch", return_value="tutor_agent"), \
         patch("v1.agents.router_endpoint.run_curriculum") as rc, \
         patch("v1.agents.router_endpoint.httpx.AsyncClient"):

        async def async_rc(*args, **kwargs):
            return {
                "decision": {"topicId": "l1-t02"},
                "memory": [],
                "stored": {"id": "m1"},
                "promptHash": "abc",
                "toolCalls": [],
                "deterministicOutputs": {},
                "agentName": "tutor_agent",
            }
        rc.side_effect = async_rc
        yield


def test_run_agent_requires_idempotency_key():
    from v1.agents.router_endpoint import AgentRequest, run_agent, HTTPException
    req = AgentRequest(userId="u1", intent="tutor", query="what next?")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(run_agent(req, _fake_request(""), CALLER))
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "IDEMPOTENCY_KEY_REQUIRED"


def test_run_agent_rejects_short_idempotency_key():
    from v1.agents.router_endpoint import AgentRequest, run_agent, HTTPException
    req = AgentRequest(userId="u1", intent="tutor", query="what next?")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(run_agent(req, _fake_request("short"), CALLER))
    assert exc.value.status_code == 400


def test_run_agent_rejects_a_user_id_that_is_not_the_caller():
    from v1.agents.router_endpoint import AgentRequest, run_agent, HTTPException
    req = AgentRequest(userId="someone-else", intent="tutor", query="what next?")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(run_agent(req, _fake_request("abcdefgh"), CALLER))
    assert exc.value.status_code == 403


def test_run_agent_rejects_unknown_intent():
    from v1.agents.router_endpoint import AgentRequest, run_agent, HTTPException
    req = AgentRequest(userId="u1", intent="unknown_intent", query="x")
    with patch("v1.agents.router_endpoint.dispatch", side_effect=ValueError("unknown_intent:unknown_intent")):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(run_agent(req, _fake_request("abcdefgh"), CALLER))
    assert exc.value.status_code == 400


def test_run_agent_returns_decision_with_idempotency_key():
    from v1.agents.router_endpoint import AgentRequest, run_agent
    req = AgentRequest(userId="u1", intent="tutor", query="what next?")
    result = asyncio.run(run_agent(req, _fake_request("abcdefgh"), CALLER))
    assert result["decision"]["topicId"] == "l1-t02"
    assert result["idempotencyKey"] == "u1:tutor:abcdefgh"