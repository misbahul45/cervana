from __future__ import annotations

from datetime import datetime, timezone
from http import HTTPStatus

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from config.trace_context import current_trace_id
from errors.types import AIServiceError


INTERNAL_MESSAGE = "Internal server error"

STATUS_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
}


def _stamp() -> dict:
    return {
        "requestId": current_trace_id(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _phrase(status: int) -> str:
    try:
        return HTTPStatus(status).phrase
    except ValueError:
        return "Error"


def _http_parts(exc: StarletteHTTPException) -> tuple[str, str, dict]:
    status = exc.status_code
    if status >= 500:
        return "INTERNAL_ERROR", INTERNAL_MESSAGE, {}
    detail = exc.detail
    if isinstance(detail, dict):
        code = str(detail.get("code") or STATUS_CODES.get(status, f"HTTP_{status}"))
        message = str(detail.get("message") or _phrase(status))
        extra = {k: v for k, v in detail.items() if k not in {"code", "message"}}
        return code, message, extra
    code = STATUS_CODES.get(status, f"HTTP_{status}")
    return code, str(detail) if detail else _phrase(status), {}


def error_envelope(exc: Exception) -> dict:
    if isinstance(exc, AIServiceError):
        return {
            "success": False,
            "code": exc.code,
            "message": exc.message,
            "details": exc.details,
            **_stamp(),
        }
    if isinstance(exc, StarletteHTTPException):
        code, message, extra = _http_parts(exc)
        body = {"success": False, "code": code, "message": message, **_stamp()}
        if extra:
            body["details"] = extra
        return body
    return {
        "success": False,
        "code": "INTERNAL_ERROR",
        "message": INTERNAL_MESSAGE,
        **_stamp(),
    }


def status_for(exc: Exception) -> int:
    if isinstance(exc, AIServiceError):
        return exc.http_status
    if isinstance(exc, StarletteHTTPException):
        return exc.status_code
    return 500


def error_response(exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=status_for(exc), content=error_envelope(exc))


async def ai_service_error_handler(request: Request, exc: AIServiceError) -> JSONResponse:
    return error_response(exc)


__all__ = ["error_envelope", "error_response", "status_for", "ai_service_error_handler"]
