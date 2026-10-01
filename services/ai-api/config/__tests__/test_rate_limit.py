import asyncio
import time
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from config.rate_limit import RateLimiter, rate_limit


def test_request_returns_full_capacity_initially():
    rl = RateLimiter(capacity_per_minute=60, burst=10)
    for _ in range(70):
        ok, _ = rl.check("client-a")
        if not ok:
            break
    else:
        pytest.fail("expected rate limit to be hit after 70 requests within capacity+burst")


def test_request_deny_returns_retry_after():
    rl = RateLimiter(capacity_per_minute=60, burst=0)
    for _ in range(60):
        rl.check("c1")
    ok, retry = rl.check("c1")
    assert ok is False
    assert retry > 0
    assert retry < 1.5


def test_request_refills_over_time(monkeypatch):
    rl = RateLimiter(capacity_per_minute=60, burst=0)

    real_time = time.time

    def fake_time():
        return 0.0

    monkeypatch.setattr("config.rate_limit.time.time", fake_time)

    for _ in range(60):
        ok, _ = rl.check("c1")
        assert ok is True

    ok, _ = rl.check("c1")
    assert ok is False

    def advanced_time():
        return 5.0

    monkeypatch.setattr("config.rate_limit.time.time", advanced_time)
    ok, _ = rl.check("c1")
    assert ok is True


def test_request_separate_clients_have_separate_buckets():
    rl = RateLimiter(capacity_per_minute=1, burst=0)
    ok_a1, _ = rl.check("client-a")
    ok_b1, _ = rl.check("client-b")
    assert ok_a1 is True
    assert ok_b1 is True
    ok_a2, _ = rl.check("client-a")
    assert ok_a2 is False


def test_rate_limit_decorator_returns_429():
    app = FastAPI()
    limiter = RateLimiter(capacity_per_minute=1, burst=0)

    @app.post("/echo")
    @rate_limit(capacity_per_minute=1, burst=0)
    async def echo(request: Request):
        from fastapi import Body
        return {"ok": True}

    client = TestClient(app)
    r1 = client.post("/echo")
    r2 = client.post("/echo")
    r3 = client.post("/echo")
    assert r1.status_code == 200
    assert r2.status_code == 429
    assert r3.status_code == 429
    body = r2.json()
    assert body["code"] == "RATE_LIMITED"
    assert "retryAfterSeconds" in body


def test_rate_limit_decorator_handles_request_via_kwarg():
    app = FastAPI()

    @app.post("/echo2")
    @rate_limit(capacity_per_minute=100, burst=0)
    async def echo2(request: Request):
        return {"ok": True}

    client = TestClient(app)
    for _ in range(100):
        assert client.post("/echo2").status_code == 200
    assert client.post("/echo2").status_code == 429