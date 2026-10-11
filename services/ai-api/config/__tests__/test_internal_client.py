from __future__ import annotations

import json
from unittest.mock import patch

import pytest
import requests

from config import service_auth
from config.agent_session import mint_session
from config.envs import ENVS
from config.internal_client import InternalApiClient
from errors.types import AuthError, CrossServiceError

SECRET = "client-test-secret"


@pytest.fixture(autouse=True)
def service_secret(monkeypatch):
    monkeypatch.setenv(service_auth.SECRET_ENV, SECRET)


@pytest.fixture
def session():
    return mint_session(acting_user_id="u-1", trace_id="trace-1", idempotency_key="request-key-0001")


def response(status=200, body=None):
    reply = requests.Response()
    reply.status_code = status
    reply._content = json.dumps(body if body is not None else {"data": None}).encode()
    return reply


class Wire:
    def __init__(self, reply):
        self.reply = reply
        self.sent = []

    def __call__(self, prepared, **kwargs):
        self.sent.append(prepared)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


@pytest.fixture
def wire():
    def install(reply):
        recorder = Wire(reply)
        patcher = patch.object(requests.Session, "send", recorder)
        patcher.start()
        install.patchers.append(patcher)
        return recorder

    install.patchers = []
    yield install
    for patcher in install.patchers:
        patcher.stop()


def header(prepared, name):
    return prepared.headers.get(name)


def test_a_read_is_signed_for_the_acting_user_without_a_bearer_token(wire, session):
    recorder = wire(response(200, {"data": {"id": "l-1"}}))

    data = InternalApiClient(session).get("/internal/lessons/l-1", params={"include": "steps"})

    assert data == {"id": "l-1"}
    prepared = recorder.sent[0]
    assert prepared.method == "GET"
    assert prepared.url == f"{ENVS['NEST_API']}/internal/lessons/l-1?include=steps"
    assert header(prepared, "x-service-id") == "ai-api"
    assert header(prepared, "x-acting-user-id") == "u-1"
    assert header(prepared, "x-trace-id") == "trace-1"
    assert header(prepared, "Authorization") is None
    assert header(prepared, "x-idempotency-key") is None
    expected = service_auth.compute_signature(
        SECRET, header(prepared, "x-service-timestamp"), "GET", prepared.path_url, b"", "u-1"
    )
    assert header(prepared, "x-service-signature") == expected


def test_a_write_signs_the_body_and_carries_a_derived_idempotency_key(wire, session):
    recorder = wire(response(201, {"data": {"id": "c-1"}}))

    InternalApiClient(session).post("/internal/contents", json_body={"chatId": "c", "data": "x"})

    prepared = recorder.sent[0]
    assert prepared.method == "POST"
    expected = service_auth.compute_signature(
        SECRET, header(prepared, "x-service-timestamp"), "POST", prepared.path_url, prepared.body, "u-1"
    )
    assert header(prepared, "x-service-signature") == expected
    assert header(prepared, "x-idempotency-key") == header(prepared, "Idempotency-Key")
    assert len(header(prepared, "x-idempotency-key")) >= 8


def test_one_request_key_yields_one_key_per_distinct_operation(wire, session):
    recorder = wire(response(200, {"data": {}}))
    client = InternalApiClient(session)

    client.patch("/internal/chat-messages/m-1", json_body={"text": "satu", "status": "PROCESSING"})
    client.patch("/internal/chat-messages/m-1", json_body={"text": "dua", "status": "PROCESSING"})
    client.patch("/internal/chat-messages/m-1", json_body={"text": "satu", "status": "PROCESSING"})
    client.patch("/internal/chat-messages/m-2", json_body={"text": "satu", "status": "PROCESSING"})

    keys = [header(prepared, "x-idempotency-key") for prepared in recorder.sent]
    assert keys[0] == keys[2]
    assert len({keys[0], keys[1], keys[3]}) == 3


def test_a_retry_of_the_same_operation_in_a_new_session_key_is_a_different_operation(wire):
    recorder = wire(response(200, {"data": {}}))
    first = mint_session(acting_user_id="u-1", trace_id="t", idempotency_key="request-key-0001")
    second = mint_session(acting_user_id="u-1", trace_id="t", idempotency_key="request-key-0002")
    body = {"text": "satu", "status": "PROCESSING"}

    InternalApiClient(first).patch("/internal/chat-messages/m-1", json_body=body)
    InternalApiClient(second).patch("/internal/chat-messages/m-1", json_body=body)

    keys = [header(prepared, "x-idempotency-key") for prepared in recorder.sent]
    assert keys[0] != keys[1]


def test_send_returns_the_whole_envelope(wire, session):
    wire(response(201, {"success": True, "data": {"id": "q-1"}}))

    envelope = InternalApiClient(session).send(
        "POST", "/internal/personality-quizzes", json_body={"lessonId": "l"}
    )

    assert envelope == {"success": True, "data": {"id": "q-1"}}


@pytest.mark.parametrize(
    "status, error, reason",
    [
        (401, CrossServiceError, "service_credentials_rejected"),
        (403, AuthError, None),
        (404, CrossServiceError, None),
        (400, CrossServiceError, None),
        (500, CrossServiceError, None),
        (503, CrossServiceError, None),
    ],
)
def test_error_statuses_become_typed_errors(wire, session, status, error, reason):
    wire(response(status, {"message": "nope"}))

    with pytest.raises(error) as raised:
        InternalApiClient(session).get("/internal/lessons/l-1")

    assert raised.value.details["status"] == status
    assert raised.value.details["url"].endswith("/internal/lessons/l-1")
    if reason:
        assert raised.value.details["reason"] == reason


def test_a_network_failure_becomes_a_cross_service_error(wire, session):
    wire(requests.ConnectionError("refused"))

    with pytest.raises(CrossServiceError) as raised:
        InternalApiClient(session).get("/internal/lessons/l-1")

    assert "refused" in raised.value.details["error"]


def test_a_missing_service_secret_fails_closed_with_a_typed_error(monkeypatch, wire, session):
    monkeypatch.delenv(service_auth.SECRET_ENV, raising=False)
    recorder = wire(response(200))

    with pytest.raises(CrossServiceError) as raised:
        InternalApiClient(session).get("/internal/lessons/l-1")

    assert raised.value.details["reason"] == "service_secret_missing"
    assert recorder.sent == []
