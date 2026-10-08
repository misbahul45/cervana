from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from middleware.trace_id import TraceIdMiddleware, TRACE_HEADER


def _app():
    app = FastAPI()
    app.add_middleware(TraceIdMiddleware)

    @app.get("/probe")
    async def probe(request: Request):
        return {"trace_id": getattr(request.state, "trace_id", None)}

    return app


def test_inbound_trace_id_is_echoed():
    client = TestClient(_app())
    response = client.get("/probe", headers={TRACE_HEADER: "abc-123"})
    assert response.status_code == 200
    assert response.headers.get(TRACE_HEADER)
    assert response.json()["trace_id"] == "abc-123"


def test_missing_trace_id_is_generated():
    client = TestClient(_app())
    response = client.get("/probe")
    assert response.status_code == 200
    assert response.headers.get(TRACE_HEADER)
    assert response.json()["trace_id"]