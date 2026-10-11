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
        == "0731547b939105b307e9e4d0ca118d9019d4f7c3718cb4cac4af06a3b55e9a43"
    )
    assert (
        service_auth.compute_signature(
            SECRET, TIMESTAMP, "GET", "/api/v1/internal/resources/abc", b""
        )
        == "e831a76ae7cec5845df9566562726ffe8b2d9aedeabb4fec5a5b741644f68fa5"
    )


def test_acting_user_is_signed_and_matches_the_api_vectors():
    path = "/api/v1/internal/lessons/abc"

    assert (
        service_auth.compute_signature(SECRET, TIMESTAMP, "GET", path, b"", "user-1")
        == "0e58cfbd1cf072b84d41919aed0a3e8b3367c6fb17b325caa6abe01c74d48e0b"
    )
    assert (
        service_auth.compute_signature(SECRET, TIMESTAMP, "GET", path, b"", "user-2")
        == "40a44f2a610df13d991f0f2dcf2427aae10d14d18919e658ccaf393b3521fcd2"
    )


def test_a_missing_acting_user_is_an_empty_one():
    without = service_auth.compute_signature(SECRET, TIMESTAMP, "GET", "/x", b"")

    assert service_auth.compute_signature(SECRET, TIMESTAMP, "GET", "/x", b"", "") == without
    assert service_auth.compute_signature(SECRET, TIMESTAMP, "GET", "/x", b"", "user-1") != without


def test_signed_headers_sign_the_acting_user_they_carry():
    headers = service_auth.signed_headers(
        "GET", "/x", b"", secret=SECRET, timestamp=TIMESTAMP, acting_user_id="user-1"
    )

    assert headers[service_auth.SERVICE_SIGNATURE_HEADER] == service_auth.compute_signature(
        SECRET, TIMESTAMP, "GET", "/x", b"", "user-1"
    )
    assert headers[service_auth.ACTING_USER_HEADER] == "user-1"


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
