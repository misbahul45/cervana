from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.testclient import TestClient

from config.redis_client import configure_redis_client
from config.user_auth import authenticated_user
from middleware.idempotency import require_idempotency_key
from middleware.idempotency_store import IdempotencyStore

KEY = "abcdefgh-1234"


def _app(handler_calls, *, deduplicate=True, outcome=None):
    app = FastAPI()

    def current_user(request: Request) -> dict:
        return {"id": request.headers.get("x-test-user", "u-1")}

    @app.post("/probe")
    @require_idempotency_key(mint_if_missing=False, deduplicate=deduplicate)
    async def probe(request: Request, body: dict, user: dict = Depends(current_user)):
        handler_calls.append(body)
        if isinstance(outcome, Exception):
            raise outcome
        if outcome is not None:
            return outcome
        return {"task_id": f"task-{len(handler_calls)}", "user": user["id"]}

    return app


def _post(client, body=None, key=KEY, user="u-1"):
    return client.post(
        "/probe",
        json=body or {"query": "halo"},
        headers={"Idempotency-Key": key, "x-test-user": user},
    )


def test_a_repeated_request_runs_the_handler_once_and_replays_the_first_response(fake_redis):
    calls = []
    client = TestClient(_app(calls))

    first = _post(client)
    second = _post(client)

    assert len(calls) == 1
    assert second.status_code == 200
    assert second.json() == first.json() == {"task_id": "task-1", "user": "u-1"}
    assert second.headers["Idempotent-Replayed"] == "true"
    assert "Idempotent-Replayed" not in first.headers


def test_reusing_a_key_with_a_different_body_is_rejected(fake_redis):
    calls = []
    client = TestClient(_app(calls))
    _post(client, body={"query": "satu"})

    response = _post(client, body={"query": "dua"})

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "IDEMPOTENCY_KEY_REUSED"
    assert len(calls) == 1


def test_the_same_key_from_two_users_runs_twice(fake_redis):
    calls = []
    client = TestClient(_app(calls))

    _post(client, user="u-1")
    _post(client, user="u-2")

    assert len(calls) == 2


def test_a_failed_request_releases_the_key_so_it_can_be_retried(fake_redis):
    calls = []
    client = TestClient(_app(calls, outcome=HTTPException(status_code=503, detail="queue down")), raise_server_exceptions=False)

    assert _post(client).status_code == 503
    assert _post(client).status_code == 503

    assert len(calls) == 2


def test_an_error_body_returned_with_status_200_is_not_remembered(fake_redis):
    calls = []
    client = TestClient(_app(calls, outcome={"error": "Generation failed"}))

    _post(client)
    _post(client)

    assert len(calls) == 2


def test_a_response_that_cannot_be_replayed_answers_conflict_on_repeat(fake_redis):
    from fastapi.responses import StreamingResponse

    calls = []
    client = TestClient(_app(calls, outcome=StreamingResponse(iter([b"data: x\n\n"]))))

    first = _post(client)
    second = _post(client)

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "IDEMPOTENT_REQUEST_ALREADY_PROCESSED"
    assert len(calls) == 1


def test_deduplication_can_be_switched_off_for_a_route(fake_redis):
    calls = []
    client = TestClient(_app(calls, deduplicate=False))

    _post(client)
    _post(client)

    assert len(calls) == 2


def test_an_unreachable_redis_lets_every_request_through(fake_redis):
    fake_redis.unavailable = True
    calls = []
    client = TestClient(_app(calls))

    assert _post(client).status_code == 200
    assert _post(client).status_code == 200

    assert len(calls) == 2


def test_without_a_redis_client_requests_are_not_deduplicated():
    configure_redis_client(None)
    calls = []
    client = TestClient(_app(calls))

    _post(client)
    _post(client)

    assert len(calls) == 2


def test_a_minted_key_is_never_deduplicated(fake_redis):
    calls = []
    app = FastAPI()

    @app.post("/minted")
    @require_idempotency_key(mint_if_missing=True)
    async def minted(request: Request, body: dict):
        calls.append(body)
        return {"ok": True}

    client = TestClient(app)
    client.post("/minted", json={"query": "halo"})
    client.post("/minted", json={"query": "halo"})

    assert len(calls) == 2


class TestIdempotencyStore:
    def test_a_second_claim_while_the_first_is_running_reports_in_flight(self, fake_redis):
        store = IdempotencyStore(fake_redis)
        assert store.claim("scope", "fp").kind == "new"

        assert store.claim("scope", "fp").kind == "in_flight"

    def test_an_abandoned_claim_expires(self, fake_redis):
        now = [1_000.0]
        fake_redis.clock = lambda: now[0]
        store = IdempotencyStore(fake_redis, in_flight_ttl_seconds=60)
        store.claim("scope", "fp")

        now[0] += 61

        assert store.claim("scope", "fp").kind == "new"

    def test_a_completed_record_is_replayed_until_it_expires(self, fake_redis):
        now = [1_000.0]
        fake_redis.clock = lambda: now[0]
        store = IdempotencyStore(fake_redis, completed_ttl_seconds=100)
        store.claim("scope", "fp")
        store.complete("scope", "fp", status_code=200, body={"task_id": "t-1"})

        replay = store.claim("scope", "fp")
        assert (replay.kind, replay.status_code, replay.body) == ("replay", 200, {"task_id": "t-1"})

        now[0] += 101

        assert store.claim("scope", "fp").kind == "new"

    def test_a_claim_with_another_fingerprint_is_a_mismatch(self, fake_redis):
        store = IdempotencyStore(fake_redis)
        store.claim("scope", "fp-1")
        store.complete("scope", "fp-1", status_code=200, body={})

        assert store.claim("scope", "fp-2").kind == "mismatch"

    def test_release_frees_the_claim(self, fake_redis):
        store = IdempotencyStore(fake_redis)
        store.claim("scope", "fp")

        store.release("scope")

        assert store.claim("scope", "fp").kind == "new"

    def test_an_unreachable_store_reports_unavailable(self, fake_redis):
        fake_redis.unavailable = True

        assert IdempotencyStore(fake_redis).claim("scope", "fp").kind == "unavailable"


def test_a_repeated_chat_request_enqueues_one_task(fake_redis):
    from v1.learning.router import router

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[authenticated_user] = lambda: {"id": "u-1", "role": "STUDENT"}
    delay = MagicMock(return_value=SimpleNamespace(id="task-1"))
    body = {"chatId": "c-1", "userStepId": "us-1", "messageId": "m-1", "query": "apa itu debit?"}

    with patch("v1.learning.router.generating_new_content", SimpleNamespace(delay=delay)):
        client = TestClient(app)
        first = client.post("/learning/chat", json=body, headers={"Idempotency-Key": KEY})
        second = client.post("/learning/chat", json=body, headers={"Idempotency-Key": KEY})

    assert first.status_code == second.status_code == 200
    assert delay.call_count == 1
    assert second.json()["task_id"] == first.json()["task_id"] == "task-1"
