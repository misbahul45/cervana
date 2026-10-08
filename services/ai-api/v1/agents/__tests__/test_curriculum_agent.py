import os
from unittest.mock import MagicMock
import pytest

from v1.agents.curriculum_agent import run_curriculum


class FakeResponse:
    def __init__(self, json_data):
        self._json = json_data

    def raise_for_status(self):
        return None

    def json(self):
        return self._json


def make_fetcher(get_payloads, post_payload):
    fetcher = MagicMock()

    async def fake_get(url, params=None, headers=None):
        fetcher.get_calls.append((url, params, headers))
        return FakeResponse(get_payloads.pop(0))

    async def fake_post(url, json=None, headers=None):
        fetcher.post_calls.append((url, json, headers))
        return FakeResponse(post_payload)

    fetcher.get = fake_get
    fetcher.post = fake_post
    fetcher.get_calls = []
    fetcher.post_calls = []
    return fetcher


@pytest.mark.asyncio
async def test_curriculum_agent_calls_api_policy_and_memory(monkeypatch):
    monkeypatch.setenv("NEST_API", "http://api:3002/api/v1")
    fetcher = make_fetcher(
        get_payloads=[
            {"topicId": "l1-t02", "level": 1, "rationaleKind": "progression"},
            [],
        ],
        post_payload={"id": "mem1"},
    )

    result = await run_curriculum(
        user_id="u1",
        lesson_id="l1-t01",
        query="what next?",
        token="Bearer test-token",
        fetcher=fetcher,
    )

    assert result["decision"]["topicId"] == "l1-t02"
    assert result["stored"]["id"] == "mem1"
    assert len(fetcher.get_calls) == 2
    assert fetcher.get_calls[0][0] == "http://api:3002/api/v1/personalization/policy/next"
    assert fetcher.get_calls[1][1] is not None and fetcher.get_calls[1][1].get("lessonId") == "l1-t01"
    assert fetcher.post_calls[0][0] == "http://api:3002/api/v1/personalization/memory"
    assert fetcher.post_calls[0][2]["Authorization"] == "Bearer test-token"


@pytest.mark.asyncio
async def test_curriculum_agent_forwards_user_token_in_policy_lesson():
    os.environ["NEST_API"] = "http://api:3002"
    fetcher = make_fetcher(
        get_payloads=[
            {"topicId": "l1-t02", "level": 1, "rationaleKind": "progression"},
            [],
        ],
        post_payload={"id": "mem1"},
    )

    await run_curriculum(
        user_id="u1",
        lesson_id="l1-t01",
        query="what next?",
        token="Bearer user-jwt",
        fetcher=fetcher,
    )
    policy_call = fetcher.get_calls[0]
    assert policy_call[2]["Authorization"] == "Bearer user-jwt"
    memory_post = fetcher.post_calls[0]
    assert memory_post[2]["Authorization"] == "Bearer user-jwt"