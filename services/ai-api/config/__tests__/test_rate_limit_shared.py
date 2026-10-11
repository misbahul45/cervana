from __future__ import annotations

from fastapi import Depends, FastAPI, Request
from fastapi.testclient import TestClient

from config.rate_limit import RateLimiter, rate_limit
from config.redis_client import configure_redis_client


def test_limiters_in_separate_processes_share_one_budget(fake_redis):
    first_process = RateLimiter(capacity_per_minute=2, burst=0, redis_client=fake_redis)
    second_process = RateLimiter(capacity_per_minute=2, burst=0, redis_client=fake_redis)

    assert first_process.check("user:u-1:chat")[0] is True
    assert second_process.check("user:u-1:chat")[0] is True
    assert first_process.check("user:u-1:chat")[0] is False
    assert second_process.check("user:u-1:chat")[0] is False


def test_the_budget_is_restored_in_the_next_minute(fake_redis, monkeypatch):
    limiter = RateLimiter(capacity_per_minute=1, burst=0, redis_client=fake_redis)
    monkeypatch.setattr("config.rate_limit.time.time", lambda: 600.0)
    assert limiter.check("k")[0] is True
    assert limiter.check("k")[0] is False

    monkeypatch.setattr("config.rate_limit.time.time", lambda: 661.0)

    assert limiter.check("k")[0] is True


def test_a_denial_reports_the_seconds_left_in_the_window(fake_redis, monkeypatch):
    limiter = RateLimiter(capacity_per_minute=1, burst=0, redis_client=fake_redis)
    monkeypatch.setattr("config.rate_limit.time.time", lambda: 630.0)
    limiter.check("k")

    allowed, retry_after = limiter.check("k")

    assert allowed is False
    assert retry_after == 30.0


def test_burst_extends_the_per_minute_allowance(fake_redis):
    limiter = RateLimiter(capacity_per_minute=2, burst=1, redis_client=fake_redis)

    results = [limiter.check("k")[0] for _ in range(4)]

    assert results == [True, True, True, False]


def test_an_unreachable_redis_falls_back_to_the_local_limit(fake_redis):
    fake_redis.unavailable = True
    limiter = RateLimiter(capacity_per_minute=1, burst=0, redis_client=fake_redis)

    assert limiter.check("k")[0] is True
    assert limiter.check("k")[0] is False


def _app_with_user_dependency():
    app = FastAPI()

    def current_user(request: Request) -> dict:
        return {"id": request.headers.get("x-test-user", "u-anonymous")}

    @app.post("/probe")
    @rate_limit(capacity_per_minute=1, burst=0)
    async def probe(request: Request, user: dict = Depends(current_user)):
        return {"user": user["id"]}

    return app


def test_the_limit_is_kept_per_user_not_per_peer_address(fake_redis):
    client = TestClient(_app_with_user_dependency())

    assert client.post("/probe", headers={"x-test-user": "u-1"}).status_code == 200
    assert client.post("/probe", headers={"x-test-user": "u-1"}).status_code == 429
    assert client.post("/probe", headers={"x-test-user": "u-2"}).status_code == 200


def test_a_second_worker_serving_the_same_route_shares_the_users_budget(fake_redis):
    first_worker = TestClient(_app_with_user_dependency())
    second_worker = TestClient(_app_with_user_dependency())

    assert first_worker.post("/probe", headers={"x-test-user": "u-1"}).status_code == 200
    assert second_worker.post("/probe", headers={"x-test-user": "u-1"}).status_code == 429


def test_without_a_redis_client_the_decorator_still_limits_locally():
    configure_redis_client(None)
    client = TestClient(_app_with_user_dependency())

    assert client.post("/probe", headers={"x-test-user": "u-9"}).status_code == 200
    assert client.post("/probe", headers={"x-test-user": "u-9"}).status_code == 429
