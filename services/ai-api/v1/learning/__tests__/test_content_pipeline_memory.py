from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from utils.tools import memory
from v1.learning import content_pipeline
from v1.learning.dto import GenerateContentMaterialPipeline


def make_state():
    return GenerateContentMaterialPipeline.model_construct(
        user_id="u-1",
        step_id="s-1",
        user_step_id="us-1",
        topic_id="t-1",
        lesson_id="l-1",
        learning_style_id="ls-1",
        message_id="m-1",
        chat_id="c-1",
        session_id="sess-1",
        acting_user_id="u-1",
        tenant_id="tenant-1",
        trace_id="trace-1",
        idempotency_key="k-1",
        topic=SimpleNamespace(title="Akuntansi"),
        lesson=SimpleNamespace(title="Jurnal"),
        step=SimpleNamespace(title="Penyesuaian"),
        user_step=SimpleNamespace(title="Jurnal penyesuaian"),
        learning_style=SimpleNamespace(dominant_style="visual"),
        context="konteks",
        generate=None,
    )


@pytest.fixture
def memory_manager():
    manager = MagicMock()
    manager.retrieve.return_value = []
    with patch.object(memory, "memory_manager", manager):
        yield manager


@pytest.fixture
def pipeline_io():
    with patch.object(content_pipeline, "update_message_chat"), patch.object(
        content_pipeline, "retrieve_material_rag", return_value=("", [])
    ), patch.object(content_pipeline, "retrieve_material_web", return_value=""), patch.object(
        content_pipeline, "_render_tutor_system_policy", return_value="policy"
    ), patch.object(content_pipeline, "query_content_history", return_value=[]):
        yield


def lesson_memory(text, lesson_id):
    return {"text": text, "metadata": {"lessonId": lesson_id, "timestamp": "2026-01-01T00:00:00"}}


def test_the_learner_analysis_is_stored_as_memory_of_the_current_lesson(scripted_llm, memory_manager, pipeline_io):
    scripted_llm.reply("flash", "Ringkasan analisis pelajar.")

    content_pipeline.prepare_learning_context(make_state())

    memory_manager.upsert.assert_called_once()
    stored = memory_manager.upsert.call_args.kwargs
    assert stored["user_id"] == "u-1"
    assert stored["text"] == "Ringkasan analisis pelajar."
    assert stored["metadata"]["lessonId"] == "l-1"


def test_only_memory_of_the_current_lesson_reaches_the_context(scripted_llm, memory_manager, pipeline_io):
    scripted_llm.reply("flash", "Ringkasan analisis pelajar.")
    memory_manager.retrieve.return_value = [
        lesson_memory("catatan pelajaran ini", "l-1"),
        lesson_memory("catatan pelajaran lain", "l-2"),
    ]

    state = content_pipeline.prepare_learning_context(make_state())

    assert memory_manager.retrieve.call_args.kwargs["user_id"] == "u-1"
    assert "catatan pelajaran ini" in state.context
    assert "catatan pelajaran lain" not in state.context


def test_the_generated_material_is_stored_as_memory_of_the_current_lesson(scripted_llm, memory_manager, pipeline_io):
    scripted_llm.reply("thinking", "## Materi\n\nIsi pelajaran.")

    content_pipeline.generate_material(make_state())

    memory_manager.upsert.assert_called_once()
    stored = memory_manager.upsert.call_args.kwargs
    assert stored["user_id"] == "u-1"
    assert stored["text"] == "## Materi\n\nIsi pelajaran."
    assert stored["metadata"]["lessonId"] == "l-1"


def test_the_text_of_the_content_history_reaches_the_context(scripted_llm, memory_manager, pipeline_io):
    scripted_llm.reply("flash", "Ringkasan analisis pelajar.")
    history = [{"id": "c-1", "chatId": "chat-1", "text": "riwayat penting", "score": 1.0}]

    with patch.object(content_pipeline, "query_content_history", return_value=history):
        state = content_pipeline.prepare_learning_context(make_state())

    assert "riwayat penting" in state.context
