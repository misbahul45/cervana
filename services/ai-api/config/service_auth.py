import hashlib
import hmac
import os
import time
import uuid

import requests

SERVICE_ID = "ai-api"
SECRET_ENV = "INTERNAL_AI_API_SECRET"

SERVICE_ID_HEADER = "x-service-id"
SERVICE_TIMESTAMP_HEADER = "x-service-timestamp"
SERVICE_SIGNATURE_HEADER = "x-service-signature"
TRACE_ID_HEADER = "x-trace-id"
IDEMPOTENCY_KEY_HEADER = "x-idempotency-key"
IDEMPOTENCY_KEY_GLOBAL_HEADER = "Idempotency-Key"
ACTING_USER_HEADER = "x-acting-user-id"

READ_METHODS = {"GET", "HEAD"}


def canonical_string(timestamp: str, method: str, target: str, body: bytes) -> str:
    return "\n".join([timestamp, method.upper(), target, hashlib.sha256(body).hexdigest()])


def compute_signature(secret: str, timestamp: str, method: str, target: str, body: bytes) -> str:
    message = canonical_string(timestamp, method, target, body).encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def _secret() -> str:
    secret = os.getenv(SECRET_ENV, "")
    if not secret:
        raise RuntimeError(f"{SECRET_ENV} is not configured")
    return secret


def signed_headers(
    method: str,
    target: str,
    body: bytes = b"",
    *,
    secret: str | None = None,
    timestamp: str | None = None,
    trace_id: str | None = None,
    idempotency_key: str | None = None,
    acting_user_id: str | None = None,
) -> dict[str, str]:
    ts = timestamp or str(int(time.time() * 1000))
    headers = {
        SERVICE_ID_HEADER: SERVICE_ID,
        SERVICE_TIMESTAMP_HEADER: ts,
        SERVICE_SIGNATURE_HEADER: compute_signature(secret or _secret(), ts, method, target, body),
        TRACE_ID_HEADER: trace_id or str(uuid.uuid4()),
    }
    if method.upper() not in READ_METHODS:
        key = idempotency_key or str(uuid.uuid4())
        headers[IDEMPOTENCY_KEY_HEADER] = key
        headers[IDEMPOTENCY_KEY_GLOBAL_HEADER] = key
    if acting_user_id:
        headers[ACTING_USER_HEADER] = acting_user_id
    return headers


def send_signed(
    method: str,
    url: str,
    *,
    json_body: dict | None = None,
    params: dict | None = None,
    trace_id: str | None = None,
    idempotency_key: str | None = None,
    acting_user_id: str | None = None,
    timeout: int = 15,
) -> requests.Response:
    prepared = requests.Request(method, url, json=json_body, params=params).prepare()
    body = prepared.body or b""
    if isinstance(body, str):
        body = body.encode("utf-8")
    prepared.headers.update(
        signed_headers(
            method,
            prepared.path_url,
            body,
            trace_id=trace_id,
            idempotency_key=idempotency_key,
            acting_user_id=acting_user_id,
        )
    )
    with requests.Session() as session:
        return session.send(prepared, timeout=timeout)
