from __future__ import annotations

import contextvars
import uuid


_trace_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "trace_id", default=None
)


def current_trace_id() -> str | None:
    return _trace_id_var.get()


def set_trace_id(value: str | None) -> contextvars.Token:
    return _trace_id_var.set(value)


def reset_trace_id(token: contextvars.Token) -> None:
    _trace_id_var.reset(token)


def new_trace_id() -> str:
    return str(uuid.uuid4())


def resolve_inbound_trace_id(provided: str | None) -> str:
    if provided and provided.strip():
        return provided.strip()[:128]
    return new_trace_id()