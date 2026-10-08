from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from config.rate_limit import RateLimiter, rate_limit


def _make_app(capacity: int = 2, burst: int = 0):
    app = FastAPI()
    limiter = RateLimiter(capacity_per_minute=capacity, burst=burst, redis_client=None)

    @app.post("/probe")
    @rate_limit(capacity_per_minute=capacity, burst=burst)
    async def probe(request: Request):
        return {"ok": True}

    app.state.limiter = limiter
    return app


def test_rate_limit_returns_429_after_capacity():
    app = _make_app(capacity=2, burst=0)
    client = TestClient(app)
    assert client.post("/probe").status_code == 200
    assert client.post("/probe").status_code == 200
    response = client.post("/probe")
    assert response.status_code == 429
    assert response.json()["code"] == "RATE_LIMITED"


def test_decorating_an_endpoint_without_a_request_parameter_fails_loudly():
    import pytest

    with pytest.raises(TypeError, match="request"):

        @rate_limit(capacity_per_minute=2, burst=0)
        async def unguarded():
            return {"ok": True}


def test_every_rate_limited_route_declares_its_request_parameter():
    import inspect

    import main

    missing = []
    for route in main.app.routes:
        endpoint = getattr(route, "endpoint", None)
        if endpoint is None or not getattr(endpoint, "__rate_limited__", False):
            continue
        if "request" not in inspect.signature(endpoint).parameters:
            missing.append(route.path)
    assert missing == []
