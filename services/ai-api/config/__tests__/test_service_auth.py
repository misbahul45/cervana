import pytest

from config import service_auth


SECRET = "test-secret"
TIMESTAMP = "1700000000000"


def test_signature_matches_the_api_vectors():
    assert (
        service_auth.compute_signature(
            SECRET,
            TIMESTAMP,
            "POST",
            "/api/v1/internal/resources/callback?type=EXTRACT",
            b'{"resourceId":"x"}',
        )
        == "0701934646b2b65fb28ac0579df3663956fcc02c313ab5d15b0cb1c4f6bbf3a2"
    )
    assert (
        service_auth.compute_signature(
            SECRET, TIMESTAMP, "GET", "/api/v1/internal/resources/abc", b""
        )
        == "8396f8bf7c5d931115f46af03ad4e81ca45fc48559eb502adff0a478e03567af"
    )


def test_method_is_case_insensitive():
    lower = service_auth.compute_signature(SECRET, TIMESTAMP, "post", "/x", b"")
    upper = service_auth.compute_signature(SECRET, TIMESTAMP, "POST", "/x", b"")
    assert lower == upper


def test_mutations_carry_an_idempotency_key_and_reads_do_not():
    post = service_auth.signed_headers("POST", "/x", b"{}", secret=SECRET)
    get = service_auth.signed_headers("GET", "/x", b"", secret=SECRET)
    assert post[service_auth.IDEMPOTENCY_KEY_HEADER]
    assert service_auth.IDEMPOTENCY_KEY_HEADER not in get
    assert post[service_auth.SERVICE_ID_HEADER] == "ai-api"


def test_explicit_idempotency_key_and_acting_user_are_forwarded():
    headers = service_auth.signed_headers(
        "POST",
        "/x",
        b"{}",
        secret=SECRET,
        idempotency_key="fixed-key",
        acting_user_id="user-1",
        trace_id="trace-1",
    )
    assert headers[service_auth.IDEMPOTENCY_KEY_HEADER] == "fixed-key"
    assert headers[service_auth.ACTING_USER_HEADER] == "user-1"
    assert headers[service_auth.TRACE_ID_HEADER] == "trace-1"


def test_missing_secret_fails_closed(monkeypatch):
    monkeypatch.delenv(service_auth.SECRET_ENV, raising=False)
    with pytest.raises(RuntimeError):
        service_auth.signed_headers("GET", "/x", b"")


def test_send_signed_signs_the_exact_bytes_and_target_that_are_sent(monkeypatch):
    monkeypatch.setenv(service_auth.SECRET_ENV, SECRET)
    captured = {}

    def fake_send(self, prepared, **kwargs):
        captured["prepared"] = prepared
        response = service_auth.requests.Response()
        response.status_code = 200
        return response

    monkeypatch.setattr(service_auth.requests.Session, "send", fake_send)

    service_auth.send_signed(
        "POST",
        "http://api:3002/api/v1/internal/resources/callback",
        json_body={"resourceId": "x"},
        params={"type": "EXTRACT"},
    )

    prepared = captured["prepared"]
    body = prepared.body if isinstance(prepared.body, bytes) else prepared.body.encode()
    expected = service_auth.compute_signature(
        SECRET,
        prepared.headers[service_auth.SERVICE_TIMESTAMP_HEADER],
        "POST",
        prepared.path_url,
        body,
    )
    assert prepared.headers[service_auth.SERVICE_SIGNATURE_HEADER] == expected
    assert prepared.path_url == "/api/v1/internal/resources/callback?type=EXTRACT"
