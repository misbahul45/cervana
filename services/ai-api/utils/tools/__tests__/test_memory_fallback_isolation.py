import importlib
import sys
import types
from unittest.mock import MagicMock, patch


def _module(name: str, **attributes) -> types.ModuleType:
    module = types.ModuleType(name)
    module.__dict__.update(attributes)
    return module


def _load_memory(items):
    manager = MagicMock()
    manager.retrieve.return_value = items
    fakes = {
        "config.embedding_pipeline": _module(
            "config.embedding_pipeline", get_embedding_pipeline=lambda: MagicMock(embed_model=None)
        ),
        "config.memory_embedding": _module("config.memory_embedding", MemoryManager=lambda embed_model: manager),
    }
    with patch.dict(sys.modules, fakes):
        sys.modules.pop("utils.tools.memory", None)
        return importlib.import_module("utils.tools.memory")


def _item(lesson_id, text="m"):
    metadata = {} if lesson_id is None else {"lessonId": lesson_id}
    return {"text": text, "metadata": metadata}


def test_fallback_never_returns_memory_that_belongs_to_another_lesson():
    memory = _load_memory([_item("L-9", "other lesson"), _item(None, "a"), _item("L-7", "another"), _item(None, "b")])

    result = memory.tool_semantic_search_with_fallback(userId="u-1", lessonId="L-1", fallback_limit=5)

    assert [m["text"] for m in result] == ["a", "b"]


def test_fallback_is_capped_and_empty_when_everything_belongs_to_other_lessons():
    memory = _load_memory([_item("L-9"), _item("L-8")])

    assert memory.tool_semantic_search_with_fallback(userId="u-1", lessonId="L-1", fallback_limit=5) == []


def test_strict_search_returns_only_the_requested_lesson():
    memory = _load_memory([_item("L-1", "mine"), _item("L-2", "theirs"), _item(None, "loose")])

    result = memory.tool_semantic_search(userId="u-1", lessonId="L-1")

    assert [m["text"] for m in result] == ["mine"]
