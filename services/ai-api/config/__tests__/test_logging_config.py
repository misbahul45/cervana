from __future__ import annotations

import json
import logging
from io import StringIO

from config.log_filters import TraceIdFilter
from config.logging_config import JsonFormatter, configure_logging


def test_json_formatter_includes_required_fields():
    formatter = JsonFormatter()
    record = logging.LogRecord(
        name="test.logger",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello %s",
        args=("world",),
        exc_info=None,
    )
    record.trace_id = "trace-xyz"
    line = formatter.format(record)
    payload = json.loads(line)
    for required in ("timestamp", "level", "logger", "trace_id", "message"):
        assert required in payload, f"missing {required}"
    assert payload["message"] == "hello world"
    assert payload["trace_id"] == "trace-xyz"
    assert payload["level"] == "INFO"


def test_trace_id_filter_injects_dash_when_no_context():
    filt = TraceIdFilter()
    record = logging.LogRecord(
        name="x", level=logging.INFO, pathname=__file__, lineno=1, msg="m", args=None, exc_info=None
    )
    assert filt.filter(record) is True
    assert record.trace_id == "-"


def test_configure_logging_is_idempotent(monkeypatch):
    import config.logging_config as logging_config

    root = logging.getLogger()
    saved_handlers = list(root.handlers)
    saved_level = root.level
    monkeypatch.setattr(logging_config, "_configured", False)
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    try:
        configure_logging()
        handlers_after_first = len(root.handlers)
        configure_logging()
        assert root.level == logging.DEBUG
        assert len(root.handlers) == handlers_after_first
    finally:
        root.handlers[:] = saved_handlers
        root.setLevel(saved_level)