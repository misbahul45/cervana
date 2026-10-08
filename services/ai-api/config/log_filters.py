from __future__ import annotations

import logging

from config.trace_context import current_trace_id


_TRACE_ID_LOG_KEY = "trace_id"


class TraceIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.trace_id = current_trace_id() or "-"
        return True


__all__ = ["TraceIdFilter", "TRACE_ID_LOG_KEY"]