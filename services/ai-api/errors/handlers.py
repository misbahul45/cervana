from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from errors.envelope import error_response
from errors.types import AIServiceError

logger = logging.getLogger(__name__)


async def _service_error(request: Request, exc: AIServiceError) -> JSONResponse:
    return error_response(exc)


async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return error_response(exc)


async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    body = {
        "success": False,
        "code": "VALIDATION_ERROR",
        "message": "Request validation failed",
        "details": [{"loc": list(e.get("loc", ())), "msg": e.get("msg"), "type": e.get("type")} for e in exc.errors()],
        "requestId": getattr(request.state, "trace_id", None),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return JSONResponse(status_code=422, content=body)


async def _unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception in ai-api")
    return error_response(exc)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AIServiceError, _service_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(Exception, _unhandled_error)
