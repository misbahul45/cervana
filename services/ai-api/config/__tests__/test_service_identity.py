from __future__ import annotations

import json

import pytest
from fastapi import Depends, FastAPI, Request
from fastapi.testclient import TestClient

from config import service_auth
from config.service_identity import REJECTION, service_actor

SECRET = "api-to-ai-test-secret"
NOW_MS = 1_800_000_000_000


@pytest.fixture(autouse=True)
def caller_secret(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", SECRET)
    monkeypatch.setattr("config.service_identity.time.time", lambda: NOW_MS / 1000)


@pytest.fixture
def client():
    app = FastAPI()

    @app.post("/ai/v1/probe")
    async def post_probe(request: Request, user: dict = Depends(service_actor)):
        return {"user": user, "caller": request.state.service_caller.service_id}

    @app.get("/ai/v1/probe")
    async def get_probe(user: dict = Depends(service_actor)):
        return {"user": user}

    return TestClient(app)


def sign(method, target, body=b"", *, acting="u-1", secret=SECRET, timestamp=NOW_MS, caller="api"):
    headers = service_auth.signed_headers(
        method,
        target,
        body,
        secret=secret,
        timestamp=str(timestamp),
        acting_user_id=acting or None,
        idempotency_key="idem-key-0001",
    )
    headers[service_auth.SERVICE_ID_HEADER] = caller
    return headers


def post(client, target="/ai/v1/probe", payload=None, **options):
    raw = json.dumps(payload or {"stepId": "s-1"}).encode()
    headers = {**sign("POST", target, raw, **options), "content-type": "application/json"}
    return client.post(target, content=raw, headers=headers)


def test_a_correctly_signed_post_identifies_the_acting_user(client):
    response = post(client)

    assert response.status_code == 200
    assert response.json() == {"user": {"id": "u-1", "via": "service", "service": "api"}, "caller": "api"}


def test_a_correctly_signed_get_without_a_body_passes(client):
    response = client.get("/ai/v1/probe?x=1", headers=sign("GET", "/ai/v1/probe?x=1"))

    assert response.status_code == 200


def test_requests_without_credentials_are_rejected(client):
    assert client.get("/ai/v1/probe").status_code == 401
    assert client.post("/ai/v1/probe", json={}).status_code == 401


def test_the_other_service_id_is_not_accepted(client):
    assert post(client, caller="ai-api").status_code == 401


def test_a_signature_made_with_another_secret_is_rejected(client):
    assert post(client, secret="some-other-secret").status_code == 401


def test_a_missing_secret_fails_closed(client, monkeypatch):
    monkeypatch.delenv("INTERNAL_API_SECRET", raising=False)

    assert post(client).status_code == 401


@pytest.mark.parametrize("offset_ms, accepted", [(0, True), (59_000, True), (-59_000, True), (61_000, False), (-61_000, False)])
def test_the_clock_window_is_sixty_seconds(client, offset_ms, accepted):
    response = post(client, timestamp=NOW_MS + offset_ms)

    assert (response.status_code == 200) is accepted
    if not accepted:
        assert response.status_code == 401


def test_a_non_numeric_timestamp_is_rejected(client):
    headers = {**sign("GET", "/ai/v1/probe"), service_auth.SERVICE_TIMESTAMP_HEADER: "yesterday"}

    assert client.get("/ai/v1/probe", headers=headers).status_code == 401


def test_a_tampered_body_is_rejected(client):
    raw = json.dumps({"stepId": "s-1"}).encode()
    headers = {**sign("POST", "/ai/v1/probe", raw), "content-type": "application/json"}

    response = client.post("/ai/v1/probe", content=json.dumps({"stepId": "s-2"}).encode(), headers=headers)

    assert response.status_code == 401


def test_a_tampered_target_is_rejected(client):
    headers = sign("GET", "/ai/v1/probe?a=1")

    assert client.get("/ai/v1/probe?a=2", headers=headers).status_code == 401


def test_a_swapped_acting_user_is_rejected(client):
    headers = {**sign("GET", "/ai/v1/probe", acting="u-1"), service_auth.ACTING_USER_HEADER: "u-2"}

    assert client.get("/ai/v1/probe", headers=headers).status_code == 401


def test_an_acting_user_added_to_a_request_signed_without_one_is_rejected(client):
    headers = {**sign("GET", "/ai/v1/probe", acting=""), service_auth.ACTING_USER_HEADER: "u-1"}

    assert client.get("/ai/v1/probe", headers=headers).status_code == 401


def test_a_signed_request_without_an_acting_user_is_a_bad_request(client):
    response = client.get("/ai/v1/probe", headers=sign("GET", "/ai/v1/probe", acting=""))

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "ACTING_USER_REQUIRED"


def test_every_authentication_failure_answers_the_same_body(client):
    bodies = [
        client.get("/ai/v1/probe").json(),
        post(client, caller="ai-api").json(),
        post(client, secret="other").json(),
        post(client, timestamp=NOW_MS - 120_000).json(),
    ]

    assert all(body == {"detail": REJECTION} for body in bodies)


def test_a_replayed_request_is_rejected(client, fake_redis):
    raw = json.dumps({"stepId": "s-1"}).encode()
    headers = {**sign("POST", "/ai/v1/probe", raw), "content-type": "application/json"}

    first = client.post("/ai/v1/probe", content=raw, headers=headers)
    second = client.post("/ai/v1/probe", content=raw, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 401


def test_a_new_signature_for_the_same_operation_is_not_a_replay(client, fake_redis):
    assert post(client, timestamp=NOW_MS).status_code == 200
    assert post(client, timestamp=NOW_MS + 1_000).status_code == 200


def test_an_unreachable_redis_does_not_block_a_valid_request(client, fake_redis):
    fake_redis.unavailable = True

    assert post(client).status_code == 200


def test_the_replay_entry_expires_with_the_window(client, fake_redis):
    clock = [NOW_MS / 1000]
    fake_redis.clock = lambda: clock[0]
    raw = json.dumps({"stepId": "s-1"}).encode()
    headers = {**sign("POST", "/ai/v1/probe", raw), "content-type": "application/json"}
    assert client.post("/ai/v1/probe", content=raw, headers=headers).status_code == 200

    clock[0] += 121

    assert client.post("/ai/v1/probe", content=raw, headers=headers).status_code == 200


def test_a_percent_encoded_path_is_signed_as_it_was_sent(client):
    target = "/ai/v1/probe?name=a%20b&sort=sortOrder%3Aasc"

    response = client.get(target, headers=sign("GET", target))

    assert response.status_code == 200
