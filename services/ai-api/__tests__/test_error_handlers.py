from __future__ import annotations

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from errors.handlers import install_error_handlers
from errors.types import AuthError, CrossServiceError


@pytest.fixture()
def client():
    app = FastAPI()
    install_error_handlers(app)

    @app.get("/teapot")
    async def teapot():
        raise HTTPException(418, "short and stout")

    @app.get("/denied")
    async def denied():
        raise HTTPException(403, "Insufficient role")

    @app.get("/keyed")
    async def keyed():
        raise HTTPException(400, detail={"code": "IDEMPOTENCY_KEY_REQUIRED", "message": "Idempotency-Key header required"})

    @app.get("/upstream")
    async def upstream():
        raise CrossServiceError("failed to reach internal api", details={"status": 502})

    @app.get("/auth")
    async def auth():
        raise AuthError("userId is required")

    @app.get("/boom")
    async def boom():
        raise RuntimeError("postgres://user:hunter2@db/prod unreachable")

    @app.get("/validated")
    async def validated(count: int):
        return {"count": count}

    return TestClient(app, raise_server_exceptions=False)


def test_unknown_route_uses_the_error_envelope(client):
    response = client.get("/missing")

    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["code"] == "NOT_FOUND"
    assert body["message"] == "Not Found"
    assert "timestamp" in body


def test_http_exception_code_follows_the_status(client):
    body = client.get("/denied").json()

    assert body["code"] == "FORBIDDEN"
    assert body["message"] == "Insufficient role"


def test_unmapped_status_still_gets_a_stable_code(client):
    body = client.get("/teapot").json()

    assert body["code"] == "HTTP_418"
    assert body["message"] == "short and stout"


def test_structured_detail_is_unpacked_not_stringified(client):
    response = client.get("/keyed")

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "IDEMPOTENCY_KEY_REQUIRED"
    assert body["message"] == "Idempotency-Key header required"


def test_service_errors_keep_their_own_code_and_status(client):
    upstream = client.get("/upstream")
    assert upstream.status_code == 502
    assert upstream.json()["code"] == "CROSS_SERVICE_ERROR"

    auth = client.get("/auth")
    assert auth.status_code == 401
    assert auth.json()["code"] == "AUTH_ERROR"


def test_unhandled_errors_do_not_leak_their_message(client):
    response = client.get("/boom")

    assert response.status_code == 500
    body = response.json()
    assert body["code"] == "INTERNAL_ERROR"
    assert body["message"] == "Internal server error"
    assert "hunter2" not in response.text


def test_validation_errors_use_the_envelope(client):
    response = client.get("/validated", params={"count": "abc"})

    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["code"] == "VALIDATION_ERROR"
