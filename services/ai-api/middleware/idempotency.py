from __future__ import annotations

import uuid
from functools import wraps
from typing import Callable

from fastapi import Header, HTTPException, Request

from config.trace_context import new_trace_id


MIN_KEY_LENGTH = 8
DEFAULT_KEY_LENGTH = 32


def require_idempotency_key(
    *,
    min_length: int = MIN_KEY_LENGTH,
    mint_if_missing: bool = True,
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
            if header_key and len(header_key.strip()) >= min_length:
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

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def current_idempotency_key(request: Request | None) -> str | None:
    if request is None:
        return None
    return getattr(request.state, "idempotency_key", None)


__all__ = ["require_idempotency_key", "current_idempotency_key"]