import pytest
from fastapi import HTTPException

from config import user_auth


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}
        self.ok = 200 <= status_code < 300

    def json(self):
        return self._payload


def patch_profile(monkeypatch, response):
    calls = []

    def fake_get(url, headers=None, timeout=None):
        calls.append((url, headers))
        return response

    monkeypatch.setattr(user_auth.requests, "get", fake_get)
    return calls


def test_missing_or_malformed_header_is_rejected_without_calling_the_api(monkeypatch):
    calls = patch_profile(monkeypatch, FakeResponse())
    for header in (None, "", "Basic abc", "Bearer", "Bearer   "):
        with pytest.raises(HTTPException) as exc:
            user_auth.authenticate(header, {"TEACHER"})
        assert exc.value.status_code == 401
    assert calls == []


def test_rejected_token_is_401(monkeypatch):
    patch_profile(monkeypatch, FakeResponse(401))
    with pytest.raises(HTTPException) as exc:
        user_auth.authenticate("Bearer bad", {"TEACHER"})
    assert exc.value.status_code == 401


def test_role_outside_the_allowed_set_is_403(monkeypatch):
    patch_profile(monkeypatch, FakeResponse(200, {"data": {"id": "u-1", "role": "STUDENT"}}))
    with pytest.raises(HTTPException) as exc:
        user_auth.authenticate("Bearer good", {"TEACHER", "ADMIN"})
    assert exc.value.status_code == 403


def test_allowed_role_returns_the_user_and_forwards_the_token(monkeypatch):
    calls = patch_profile(monkeypatch, FakeResponse(200, {"data": {"id": "u-1", "role": "TEACHER"}}))
    user = user_auth.authenticate("bearer good-token", {"TEACHER", "ADMIN"})
    assert user["id"] == "u-1"
    assert calls[0][1] == {"Authorization": "Bearer good-token"}


def test_upstream_failure_is_503_not_a_pass(monkeypatch):
    patch_profile(monkeypatch, FakeResponse(500))
    with pytest.raises(HTTPException) as exc:
        user_auth.authenticate("Bearer good", {"TEACHER"})
    assert exc.value.status_code == 503
