from __future__ import annotations

import hmac
import logging
import os
import time
from dataclasses import dataclass

from fastapi import HTTPException, Request

from config.redis_client import get_redis_client
from config.service_auth import (
    ACTING_USER_HEADER,
    SERVICE_ID_HEADER,
    SERVICE_SIGNATURE_HEADER,
    SERVICE_TIMESTAMP_HEADER,
    TRACE_ID_HEADER,
    compute_signature,
)

CALLER_SECRET_ENV = {"api": "INTERNAL_API_SECRET"}
MAX_CLOCK_SKEW_MS = 60_000
REPLAY_WINDOW_SECONDS = 120
REPLAY_KEY_PREFIX = "internal:replay"
REJECTION = "Service credentials rejected"

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ServiceCaller:
    service_id: str
    acting_user_id: str
    trace_id: str | None


def _reject(reason: str) -> HTTPException:
    logger.warning("[SERVICE_IDENTITY] rejected: %s", reason)
    return HTTPException(status_code=401, detail=REJECTION)


def _target(request: Request) -> str:
    raw_path = request.scope.get("raw_path")
    path = raw_path.decode("latin-1") if raw_path else request.url.path
    query = request.scope.get("query_string", b"").decode("latin-1")
    return f"{path}?{query}" if query else path


def _remember(service_id: str, signature: str) -> None:
    client = get_redis_client()
    if client is None:
        return
    try:
        stored = client.set(
            f"{REPLAY_KEY_PREFIX}:{service_id}:{signature}", "1", nx=True, ex=REPLAY_WINDOW_SECONDS
        )
    except Exception as exc:
        logger.warning("[SERVICE_IDENTITY] replay cache unavailable, request proceeds: %s", exc)
        return
    if not stored:
        raise _reject("replayed request")


async def verify_service_request(request: Request) -> ServiceCaller:
    headers = request.headers
    service_id = headers.get(SERVICE_ID_HEADER)
    timestamp = headers.get(SERVICE_TIMESTAMP_HEADER)
    provided = headers.get(SERVICE_SIGNATURE_HEADER)
    if not service_id or not timestamp or not provided:
        raise _reject("credentials missing")

    secret_env = CALLER_SECRET_ENV.get(service_id)
    secret = os.getenv(secret_env, "") if secret_env else ""
    if not secret:
        raise _reject(f"caller {service_id!r} unknown or its secret is not configured")

    try:
        issued_at = int(timestamp)
    except ValueError:
        raise _reject("timestamp is not a number")
    if abs(time.time() * 1000 - issued_at) > MAX_CLOCK_SKEW_MS:
        raise _reject("timestamp outside the clock window")

    acting_user_id = headers.get(ACTING_USER_HEADER, "")
    expected = compute_signature(
        secret,
        timestamp,
        request.method,
        _target(request),
        await request.body(),
        acting_user_id,
    )
    if not hmac.compare_digest(expected, provided):
        raise _reject("signature mismatch")

    if not acting_user_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "ACTING_USER_REQUIRED", "message": "x-acting-user-id header is required"},
        )

    _remember(service_id, provided)
    return ServiceCaller(
        service_id=service_id,
        acting_user_id=acting_user_id,
        trace_id=headers.get(TRACE_ID_HEADER),
    )


async def service_actor(request: Request) -> dict:
    caller = await verify_service_request(request)
    request.state.service_caller = caller
    return {"id": caller.acting_user_id, "via": "service", "service": caller.service_id}


__all__ = ["ServiceCaller", "service_actor", "verify_service_request", "REJECTION"]
