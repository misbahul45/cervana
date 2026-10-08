from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from errors.types import LLMError
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
def pipeline_io():
    with patch.object(content_pipeline, "update_message_chat") as update, patch.object(
        content_pipeline, "retrieve_material_rag", return_value=("", [])
    ), patch.object(content_pipeline, "retrieve_material_web", return_value=""), patch.object(
        content_pipeline, "_render_tutor_system_policy", return_value="policy"
    ), patch.object(content_pipeline, "tool_memory_upsert") as memory_upsert, patch.object(
        content_pipeline, "tool_semantic_search", return_value=[]
    ), patch.object(content_pipeline, "query_content_history", return_value=[]):
        yield SimpleNamespace(update=update, memory_upsert=memory_upsert)


def test_lesson_content_is_generated_in_thinking_mode(scripted_llm, pipeline_io):
    scripted_llm.reply("thinking", "## Materi\n\nIsi pelajaran.")

    state = content_pipeline.generate_material(make_state())

    assert state.generate["data"] == "## Materi\n\nIsi pelajaran."
    assert [(mode, route) for mode, route, _ in scripted_llm.calls] == [("thinking", "lesson_content")]


def test_a_failed_generation_raises_instead_of_saving_placeholder_content(scripted_llm, pipeline_io):
    scripted_llm.fail("thinking", "gateway down")

    with pytest.raises(LLMError):
        content_pipeline.generate_material(make_state())

    pipeline_io.memory_upsert.assert_not_called()
    assert not any("tidak dapat dihasilkan" in str(call) for call in pipeline_io.update.call_args_list)


def test_the_learner_analysis_uses_flash_and_degrades_to_a_plain_note_on_failure(scripted_llm, pipeline_io):
    scripted_llm.fail("flash", "down").fail("thinking", "down")

    state = content_pipeline.prepare_learning_context(make_state())

    assert "Analysis unavailable for Jurnal penyesuaian" in state.context
    assert [route for _, route, _ in scripted_llm.calls] == ["learner_analysis", "learner_analysis"]


def test_the_learner_analysis_text_reaches_the_context(scripted_llm, pipeline_io):
    scripted_llm.reply("flash", "Ringkasan analisis pelajar.")

    state = content_pipeline.prepare_learning_context(make_state())

    assert "Ringkasan analisis pelajar." in state.context
