from unittest.mock import MagicMock, patch
import pytest

from utils.tools import memory


@pytest.fixture
def fake_memory_manager():
    mm = MagicMock()
    memory.memory_manager = mm
    return mm


def _item(lesson_id, ts="2026-01-01T00:00:00"):
    md = {"timestamp": ts}
    if lesson_id is not None:
        md["lessonId"] = lesson_id
    return {"text": "memory entry", "metadata": md}


class TestMemoryLessonScope:
    def test_strict_returns_only_lesson_scoped_items(self, fake_memory_manager):
        fake_memory_manager.retrieve.return_value = [
            _item("L-1"),
            _item("L-1"),
            _item("L-2"),
            _item(None),
        ]

        result = memory.tool_semantic_search(
            userId="u-1", lessonId="L-1", top_k=15
        )

        assert len(result) == 2
        assert all(m["metadata"]["lessonId"] == "L-1" for m in result)

    def test_strict_returns_empty_when_no_match(self, fake_memory_manager):
        fake_memory_manager.retrieve.return_value = [
            _item("L-2"),
            _item("L-3"),
            _item(None),
        ]

        result = memory.tool_semantic_search(
            userId="u-1", lessonId="L-1", top_k=10
        )

        assert result == []

    def test_fallback_returns_at_most_fallback_limit_items(self, fake_memory_manager):
        fake_memory_manager.retrieve.return_value = [
            _item("L-99"),
            _item("L-99"),
            _item("L-99"),
            _item("L-99"),
        ]

        out = memory.tool_semantic_search_with_fallback(
            userId="u-1", lessonId="L-1", top_k=15, fallback_limit=2
        )

        assert len(out) <= 2

    def test_fallback_logs_at_warning_level(self, fake_memory_manager, caplog):
        fake_memory_manager.retrieve.return_value = [_item("L-99")]

        with caplog.at_level("WARNING"):
            memory.tool_semantic_search_with_fallback(
                userId="u-1", lessonId="L-1", top_k=15, fallback_limit=5
            )

        warnings = [r for r in caplog.records if r.levelname == "WARNING"]
        assert any("Unscoped memory fallback" in r.getMessage() for r in warnings)