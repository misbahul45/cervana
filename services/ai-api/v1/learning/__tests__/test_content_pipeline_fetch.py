from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from v1.learning import content_pipeline
from v1.learning.dto import GenerateContentMaterialPipeline, LessonBase

LESSON_FROM_INTERNAL_API = {
    "id": "l-1",
    "title": "Apa itu akuntansi",
    "description": None,
    "sortOrder": 1,
    "subTopicId": "st-1",
    "themeId": None,
    "createdAt": "2026-10-08T07:44:32.995Z",
    "updatedAt": "2026-10-08T07:44:32.995Z",
}


def _state():
    return GenerateContentMaterialPipeline.model_construct(
        user_id="u-1",
        step_id="s-1",
        user_step_id="us-1",
        topic_id="t-1",
        lesson_id="l-1",
        learning_style_id="",
        message_id="m-1",
        chat_id="c-1",
        session_id="sess-1",
        acting_user_id="u-1",
        tenant_id="tenant-1",
        trace_id="trace-1",
        idempotency_key="k-1",
        topic=None,
        lesson=None,
        step=None,
        user_step=None,
        learning_style=None,
        context=None,
        generate=None,
    )


def test_lesson_from_the_internal_api_is_readable_by_attribute():
    with (
        patch.object(content_pipeline, "get_lesson", return_value=LESSON_FROM_INTERNAL_API),
        patch.object(content_pipeline, "get_step", return_value=SimpleNamespace(title="Langkah 1")),
        patch.object(content_pipeline, "get_topic", return_value=SimpleNamespace(title="Akuntansi")),
        patch.object(content_pipeline, "get_user_step", return_value=SimpleNamespace(title="Langkah saya")),
        patch.object(content_pipeline, "update_message_chat") as update,
    ):
        state = content_pipeline.parallel_fetch(_state())

    assert isinstance(state.lesson, LessonBase)
    assert state.lesson.title == "Apa itu akuntansi"
    assert state.lesson.theme_id is None
    assert "Apa itu akuntansi" in update.call_args.args[2]["text"]
