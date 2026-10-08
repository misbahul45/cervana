from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from middleware.idempotency import require_idempotency_key


def _app():
    app = FastAPI()

    @app.post("/probe")
    @require_idempotency_key(mint_if_missing=False)
    async def probe(request: Request, body: dict | None = None):
        return {"idempotency_key": request.state.idempotency_key, "userId": (body or {}).get("userId")}

    return app


def test_missing_idempotency_key_returns_400():
    client = TestClient(_app())
    response = client.post("/probe", json={"userId": "u-1"})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"


def test_short_idempotency_key_returns_400():
    client = TestClient(_app())
    response = client.post(
        "/probe",
        json={"userId": "u-1"},
        headers={"Idempotency-Key": "short"},
    )
    assert response.status_code == 400


def test_valid_idempotency_key_is_recorded():
    client = TestClient(_app())
    response = client.post(
        "/probe",
        json={"userId": "u-1"},
        headers={"Idempotency-Key": "abcdefgh-1234"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["idempotency_key"] == "abcdefgh-1234"


def test_idempotency_key_is_accepted_from_the_query_for_event_streams():
    client = TestClient(_app())
    response = client.post("/probe?idempotencyKey=stream-key-12345", json={"userId": "u-1"})
    assert response.status_code == 200
    assert response.json()["idempotency_key"] == "stream-key-12345"


def test_header_wins_over_the_query_key():
    client = TestClient(_app())
    response = client.post(
        "/probe?idempotencyKey=from-the-query",
        json={"userId": "u-1"},
        headers={"Idempotency-Key": "from-the-header"},
    )
    assert response.json()["idempotency_key"] == "from-the-header"
