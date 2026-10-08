from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

CALLER = {"id": "user-a", "role": "STUDENT"}
IDEMPOTENCY = {"Idempotency-Key": "idem-key-123456"}
CHAT_BODY = {"chatId": "c1", "messageId": "m1", "userStepId": "s1", "query": "apa itu jurnal umum"}


def _profile_response(status: int = 200, user: dict | None = None) -> MagicMock:
    response = MagicMock()
    response.status_code = status
    response.ok = 200 <= status < 300
    response.json.return_value = {"data": user if user is not None else CALLER}
    return response


@pytest.fixture()
def client():
    import main

    with TestClient(main.app) as test_client:
        yield test_client


def _post_chat(client, *, headers=None, body=None):
    return client.post("/ai/v1/learning/chat", json=body or CHAT_BODY, headers={**IDEMPOTENCY, **(headers or {})})


def test_chat_rejects_a_caller_with_no_credentials(client):
    with patch("v1.learning.router.generating_new_content") as task:
        response = _post_chat(client, body={**CHAT_BODY, "userId": "victim"})

    assert response.status_code == 401
    task.delay.assert_not_called()


def test_chat_rejects_a_token_the_api_does_not_accept(client):
    with patch("config.user_auth.requests.get", return_value=_profile_response(401)), patch(
        "v1.learning.router.generating_new_content"
    ) as task:
        response = _post_chat(client, headers={"Authorization": "Bearer forged"})

    assert response.status_code == 401
    task.delay.assert_not_called()


def test_chat_rejects_acting_as_another_user(client):
    with patch("config.user_auth.requests.get", return_value=_profile_response()), patch(
        "v1.learning.router.generating_new_content"
    ) as task:
        response = _post_chat(client, headers={"Authorization": "Bearer ok"}, body={**CHAT_BODY, "userId": "victim"})

    assert response.status_code == 403
    task.delay.assert_not_called()


def test_chat_binds_the_task_to_the_authenticated_user_from_a_cookie(client):
    client.cookies.set("access_token", "cookie-token")
    with patch("config.user_auth.requests.get", return_value=_profile_response()) as profile, patch(
        "v1.learning.router.generating_new_content"
    ) as task:
        task.delay.return_value = MagicMock(id="task-1")
        response = _post_chat(client)

    assert response.status_code == 200
    assert profile.call_args.kwargs["headers"]["Authorization"] == "Bearer cookie-token"
    payload = task.delay.call_args.args[0]
    assert payload["userId"] == "user-a"
    assert payload["acting_user_id"] == "user-a"
    assert "cookie-token" not in json.dumps(payload)


def test_chat_requires_an_idempotency_key(client):
    with patch("config.user_auth.requests.get", return_value=_profile_response()), patch(
        "v1.learning.router.generating_new_content"
    ) as task:
        response = client.post("/ai/v1/learning/chat", json=CHAT_BODY, headers={"Authorization": "Bearer ok"})

    assert response.status_code == 400
    task.delay.assert_not_called()


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("post", "/ai/v1/learning/generate-material", {"userId": "victim"}),
        ("post", "/ai/v1/users-steps/generate", {"userId": "victim"}),
        (
            "get",
            "/ai/v1/users-steps/generate-question?lessonId=l&topicId=t&learningStyleId=s&userId=victim",
            None,
        ),
        ("post", "/ai/v1/agents/run", {"userId": "victim", "intent": "tutor", "query": "hi"}),
    ],
)
def test_expensive_endpoints_refuse_anonymous_and_impersonating_callers(client, method, path, body):
    send = getattr(client, method)
    kwargs = {"headers": IDEMPOTENCY}
    if body is not None:
        kwargs["json"] = body

    anonymous = send(path, **kwargs)
    assert anonymous.status_code == 401

    with patch("config.user_auth.requests.get", return_value=_profile_response()):
        kwargs["headers"] = {**IDEMPOTENCY, "Authorization": "Bearer ok"}
        impersonating = send(path, **kwargs)
    assert impersonating.status_code == 403
