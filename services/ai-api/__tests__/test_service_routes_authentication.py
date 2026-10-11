from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from config import service_auth

SECRET = "api-to-ai-test-secret"
ACTING = "user-a"
CALLER = {"id": ACTING, "role": "TEACHER"}

GENERATE_MATERIAL = {
    "stepId": "s-1",
    "userStepId": "us-1",
    "topicId": "t-1",
    "lessonId": "l-1",
    "messageId": "m-1",
    "chatId": "c-1",
}
GENERATE_STEPS = {"topicId": "t-1", "lessonId": "l-1", "learningStyleId": "ls-1", "targetStepId": "s-1"}

SERVICE_ROUTES = [
    ("/ai/v1/learning/generate-material", GENERATE_MATERIAL),
    ("/ai/v1/users-steps/generate", GENERATE_STEPS),
    ("/ai/v1/resources/extract?type=PDF&resource_id=r-1", None),
    ("/ai/v1/resources/embedding/r-1", None),
]


@pytest.fixture(autouse=True)
def service_secret(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", SECRET)


@pytest.fixture
def client():
    import main

    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture
def pipelines():
    resource = SimpleNamespace(dict=lambda: {"id": "r-1", "content": "isi"})
    with patch("v1.learning.router.generate_content_material_task") as material, patch(
        "v1.users_steps.router.generate_user_steps_pipeline"
    ) as steps, patch("v1.resources.router.extract_task") as extract, patch(
        "v1.resources.router.embedding_task"
    ) as embedding, patch("v1.resources.router.get_resource", return_value=resource):
        for task in (material, extract, embedding):
            task.delay.return_value = SimpleNamespace(id="task-1")
        steps.invoke.side_effect = lambda payload: payload
        yield SimpleNamespace(material=material, steps=steps, extract=extract, embedding=embedding)


def signed(method, target, body=None, *, acting=ACTING, secret=SECRET, key="request-key-0001"):
    raw = json.dumps(body).encode() if body is not None else b""
    headers = service_auth.signed_headers(
        method, target, raw, secret=secret, acting_user_id=acting, idempotency_key=key
    )
    headers[service_auth.SERVICE_ID_HEADER] = "api"
    if body is not None:
        headers["content-type"] = "application/json"
    return raw, headers


def send(client, path, body, **options):
    raw, headers = signed("POST", path, body, **options)
    return client.post(path, content=raw, headers=headers)


def _profile_response():
    response = MagicMock()
    response.status_code = 200
    response.ok = True
    response.json.return_value = {"data": CALLER}
    return response


@pytest.mark.parametrize("path, body", SERVICE_ROUTES)
def test_a_service_route_accepts_the_signed_service_identity(client, pipelines, path, body):
    response = send(client, path, body)

    assert response.status_code == 200, response.text


@pytest.mark.parametrize("path, body", SERVICE_ROUTES)
def test_a_service_route_refuses_an_anonymous_caller(client, pipelines, path, body):
    response = client.post(path, json=body or {}, headers={"Idempotency-Key": "request-key-0001"})

    assert response.status_code == 401


@pytest.mark.parametrize("path, body", SERVICE_ROUTES)
def test_a_service_route_refuses_a_valid_user_bearer_token(client, pipelines, path, body):
    with patch("config.user_auth.requests.get", return_value=_profile_response()) as profile:
        response = client.post(
            path,
            json=body or {},
            headers={"Authorization": "Bearer valid", "Idempotency-Key": "request-key-0001"},
        )

    assert response.status_code == 401
    profile.assert_not_called()


@pytest.mark.parametrize("path, body", SERVICE_ROUTES)
def test_a_service_route_refuses_a_signature_made_with_the_other_secret(client, pipelines, path, body):
    response = send(client, path, body, secret="the-ai-api-to-api-secret")

    assert response.status_code == 401


@pytest.mark.parametrize("path, body", SERVICE_ROUTES)
def test_a_service_route_needs_an_acting_user(client, pipelines, path, body):
    response = send(client, path, body, acting="")

    assert response.status_code == 400


def test_the_acting_user_is_the_one_the_pipeline_runs_for(client, pipelines):
    send(client, "/ai/v1/learning/generate-material", GENERATE_MATERIAL)

    payload = pipelines.material.delay.call_args.args[0]
    assert payload["acting_user_id"] == ACTING
    assert payload["user_id"] == ACTING
    assert "token" not in json.dumps(payload).lower()


def test_a_body_that_names_another_user_is_forbidden(client, pipelines):
    response = send(client, "/ai/v1/learning/generate-material", {**GENERATE_MATERIAL, "userId": "victim"})

    assert response.status_code == 403
    pipelines.material.delay.assert_not_called()


def test_the_same_request_key_runs_the_pipeline_once(client, pipelines, fake_redis):
    first = send(client, "/ai/v1/learning/generate-material", GENERATE_MATERIAL, key="retry-key-0002")
    second = send(client, "/ai/v1/learning/generate-material", GENERATE_MATERIAL, key="retry-key-0002")

    assert first.status_code == second.status_code == 200
    assert second.json() == first.json()
    assert pipelines.material.delay.call_count == 1


def test_a_user_route_ignores_the_service_identity(client):
    raw, headers = signed("POST", "/ai/v1/learning/chat", {"chatId": "c1", "messageId": "m1", "userStepId": "s1", "query": "apa itu jurnal"})

    with patch("v1.learning.router.generating_new_content") as task:
        response = client.post("/ai/v1/learning/chat", content=raw, headers=headers)

    assert response.status_code == 401
    task.delay.assert_not_called()
