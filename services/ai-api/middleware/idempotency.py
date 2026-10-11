from __future__ import annotations

import hashlib
import json
from functools import wraps
from typing import Any, Callable

from fastapi import HTTPException, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from config.redis_client import get_redis_client
from config.trace_context import new_trace_id
from middleware.idempotency_store import IdempotencyStore


MIN_KEY_LENGTH = 8
DEFAULT_KEY_LENGTH = 32
REPLAY_HEADER = "Idempotent-Replayed"


def _scope(func: Callable, kwargs: dict, key: str) -> str:
    user = kwargs.get("user")
    user_id = user.get("id") if isinstance(user, dict) else None
    return f"{func.__qualname__}:{user_id or 'anonymous'}:{key}"


async def _fingerprint(request: Request) -> str:
    material = b"\0".join(
        [
            request.method.encode(),
            request.url.path.encode(),
            request.url.query.encode(),
            await request.body(),
        ]
    )
    return hashlib.sha256(material).hexdigest()


def _is_failure(result: Any) -> bool:
    if isinstance(result, Response):
        return result.status_code >= 400
    return isinstance(result, dict) and "error" in result


def _settle(store: IdempotencyStore, scope: str, fingerprint: str, result: Any) -> None:
    if _is_failure(result):
        store.release(scope)
        return
    if isinstance(result, Response):
        store.complete(scope, fingerprint, status_code=result.status_code, body=None, replayable=False)
        return
    try:
        body = jsonable_encoder(result)
        json.dumps(body)
    except (TypeError, ValueError):
        store.complete(scope, fingerprint, status_code=None, body=None, replayable=False)
        return
    store.complete(scope, fingerprint, status_code=200, body=body)


def require_idempotency_key(
    *,
    min_length: int = MIN_KEY_LENGTH,
    mint_if_missing: bool = True,
    deduplicate: bool = True,
) -> Callable:
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request: Request | None = kwargs.get("request")
            if request is None:
                for a in args:
                    if hasattr(a, "headers"):
                        request = a
                        break

            if request is None:
                return await func(*args, **kwargs)

            header_key = request.headers.get("Idempotency-Key") or request.query_params.get("idempotencyKey") or ""
            supplied = bool(header_key) and len(header_key.strip()) >= min_length
            if supplied:
                request.state.idempotency_key = header_key.strip()[:128]
            elif mint_if_missing:
                request.state.idempotency_key = new_trace_id()
            else:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "IDEMPOTENCY_KEY_REQUIRED",
                        "message": f"Idempotency-Key header required (>= {min_length} chars)",
                    },
                )

            client = get_redis_client() if deduplicate and supplied else None
            if client is None:
                return await func(*args, **kwargs)

            store = IdempotencyStore(client)
            scope = _scope(func, kwargs, request.state.idempotency_key)
            fingerprint = await _fingerprint(request)
            claim = store.claim(scope, fingerprint)

            if claim.kind == "replay":
                return JSONResponse(
                    status_code=claim.status_code,
                    content=claim.body,
                    headers={REPLAY_HEADER: "true"},
                )
            if claim.kind == "in_flight":
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "IDEMPOTENCY_IN_PROGRESS",
                        "message": "A request with this Idempotency-Key is still being processed",
                    },
                )
            if claim.kind == "mismatch":
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "IDEMPOTENCY_KEY_REUSED",
                        "message": "Idempotency-Key was already used with a different request",
                    },
                )
            if claim.kind == "processed":
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "IDEMPOTENT_REQUEST_ALREADY_PROCESSED",
                        "message": "A request with this Idempotency-Key was already processed and cannot be replayed",
                    },
                )
            if claim.kind == "unavailable":
                return await func(*args, **kwargs)

            try:
                result = await func(*args, **kwargs)
            except BaseException:
                store.release(scope)
                raise
            _settle(store, scope, fingerprint, result)
            return result

        return wrapper

    return decorator


def current_idempotency_key(request: Request | None) -> str | None:
    if request is None:
        return None
    return getattr(request.state, "idempotency_key", None)


__all__ = ["require_idempotency_key", "current_idempotency_key"]
