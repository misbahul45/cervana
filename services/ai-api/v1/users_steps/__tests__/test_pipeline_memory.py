from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from utils.tools import memory
from v1.users_steps import generate_user_steps_pipeline
from v1.users_steps.dto import LPState

STEPS = {"data": [{"userId": "u-1", "stepTemplateId": "s-1", "title": "Mulai dari debit", "isDone": False, "order": 1}]}


def lp_state():
    return LPState.model_construct(
        user_id="u-1",
        session_id="sess-1",
        acting_user_id="u-1",
        tenant_id="tenant-1",
        trace_id="trace-1",
        idempotency_key="k-1",
        topic_id="t-1",
        lesson_id="l-1",
        learning_style_id="ls-1",
        target_step_id="s-1",
        personality_quiz_raw={"result": {"E": 3}, "userAttempt": [{"userAnswer": "a"}]},
        personality_quiz_result=SimpleNamespace(
            strengths=["a"], weaknesses=["b"], learning_preferences=["c"], motivation_factors=["d"], challenges=["e"]
        ),
        target_step=SimpleNamespace(id="s-1", title="Debit", description="d", sort_order=1),
        all_lesson_steps=[1, 2, 3],
        context="konteks",
        memory="",
        semantic_results="",
        external_results="",
        generated=None,
        error=None,
    )


@pytest.fixture
def memory_manager():
    manager = MagicMock()
    manager.retrieve.return_value = []
    with patch.object(memory, "memory_manager", manager):
        yield manager


@pytest.fixture
def plan_from_thinking_model(scripted_llm):
    scripted_llm.reply("thinking", json.dumps(STEPS))


def lesson_memory(text, lesson_id):
    return {"text": text, "metadata": {"lessonId": lesson_id, "timestamp": "2026-01-01T00:00:00"}}


def test_semantic_search_returns_only_memory_of_the_current_lesson(memory_manager):
    memory_manager.retrieve.return_value = [
        lesson_memory("catatan pelajaran ini", "l-1"),
        lesson_memory("catatan pelajaran lain", "l-2"),
    ]

    state = generate_user_steps_pipeline.node_semantic_search(lp_state())

    assert memory_manager.retrieve.call_args.kwargs["user_id"] == "u-1"
    assert state.semantic_results == "- catatan pelajaran ini"


def test_the_generated_plan_summary_is_stored_as_memory_of_the_current_lesson(
    plan_from_thinking_model, memory_manager
):
    generate_user_steps_pipeline.node_generate(lp_state())

    memory_manager.upsert.assert_called_once()
    stored = memory_manager.upsert.call_args.kwargs
    assert stored["user_id"] == "u-1"
    assert stored["text"] == "Mulai dari debit"
    assert stored["metadata"]["lessonId"] == "l-1"
