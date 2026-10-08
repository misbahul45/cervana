from __future__ import annotations

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from config.trace_context import (
    new_trace_id,
    reset_trace_id,
    set_trace_id,
    resolve_inbound_trace_id,
)

TRACE_HEADER = "x-trace-id"
TRACE_HEADER_CAMEL = "X-Trace-Id"


class TraceIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        inbound = request.headers.get(TRACE_HEADER) or request.headers.get(TRACE_HEADER_CAMEL)
        trace_id = resolve_inbound_trace_id(inbound)
        request.state.trace_id = trace_id
        token = set_trace_id(trace_id)
        try:
            response: Response = await call_next(request)
        finally:
            reset_trace_id(token)
        response.headers[TRACE_HEADER] = trace_id
        return response


__all__ = ["TraceIdMiddleware", "TRACE_HEADER"]