from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from v1.users_steps import generate_quiz_pipeline, generate_user_steps_pipeline
from v1.users_steps.dto import GenerateQuestionPipeline, LPState

PERSONALITY = {
    "strengths": ["rajin"],
    "weaknesses": ["mudah bosan"],
    "learningPreferences": ["visual"],
    "motivationFactors": ["misi kecil"],
    "challenges": ["fokus"],
}

STEPS = {"data": [{"userId": "u-1", "stepTemplateId": "s-1", "title": "Mulai dari debit", "isDone": False, "order": 1}]}

QUIZ = {"quiz": [{"question": "Soal?", "type": "input", "difficulty": "easy", "options": [], "answer": "A"}]}


def lp_state(**extra):
    base = dict(
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
    base.update(extra)
    return LPState.model_construct(**base)


class TestPersonalityMaterial:
    def test_fenced_json_from_flash_becomes_the_result(self, scripted_llm):
        scripted_llm.reply("flash", "```json\n" + json.dumps(PERSONALITY) + "\n```")

        state = generate_user_steps_pipeline.node_personality_material_builder(lp_state())

        assert state.personality_quiz_result.strengths == ["rajin"]
        assert [route for _, route, _ in scripted_llm.calls] == ["personality_quiz"]

    def test_invalid_json_from_flash_escalates_to_thinking(self, scripted_llm):
        scripted_llm.reply("flash", "Berikut profil Anda: ...").reply("thinking", json.dumps(PERSONALITY))

        state = generate_user_steps_pipeline.node_personality_material_builder(lp_state())

        assert state.personality_quiz_result.weaknesses == ["mudah bosan"]
        assert [mode for mode, _, _ in scripted_llm.calls] == ["flash", "thinking"]

    def test_total_failure_uses_the_documented_neutral_defaults(self, scripted_llm):
        scripted_llm.fail("flash").fail("thinking")

        state = generate_user_steps_pipeline.node_personality_material_builder(lp_state())

        assert state.personality_quiz_result.strengths == ["Rasa ingin tahu tinggi"]


class TestPathPlanning:
    def test_a_valid_plan_is_generated_in_thinking_mode(self, scripted_llm):
        scripted_llm.reply("thinking", json.dumps(STEPS))

        with patch.object(generate_user_steps_pipeline, "tool_memory_upsert"):
            state = generate_user_steps_pipeline.node_generate(lp_state())

        assert state.generated.data[0].title == "Mulai dari debit"
        assert [(mode, route) for mode, route, _ in scripted_llm.calls] == [("thinking", "path_planning")]

    def test_an_unusable_plan_degrades_to_one_honest_starter_step(self, scripted_llm):
        scripted_llm.reply("thinking", "bukan json")

        with patch.object(generate_user_steps_pipeline, "tool_memory_upsert"):
            state = generate_user_steps_pipeline.node_generate(lp_state())

        assert state.error == "Generation failed"
        assert state.generated.data[0].title.startswith("Mulai dari pemahaman dasar")


class TestQuizGeneration:
    def make_state(self):
        return GenerateQuestionPipeline.model_construct(
            topic_id="t-1",
            lesson_id="l-1",
            learning_style_id="ls-1",
            session_id="sess-1",
            acting_user_id="u-1",
            tenant_id="tenant-1",
            trace_id="trace-1",
            idempotency_key="k-1",
            topic=None,
            steps=None,
            learning_style=SimpleNamespace(dominant_style="visual"),
            context="materi akuntansi",
            quiz=None,
        )

    @pytest.fixture
    def pipeline_io(self):
        fake = SimpleNamespace(upsert_document=lambda **kwargs: None, retrieve=lambda **kwargs: [{"text": "rag"}])
        with patch.object(generate_quiz_pipeline, "get_embedding_pipeline", return_value=fake):
            yield

    def test_the_summary_then_the_quiz_both_route_through_flash(self, scripted_llm, pipeline_io):
        scripted_llm.reply("flash", "ringkasan materi", json.dumps(QUIZ))

        result = generate_quiz_pipeline.analyze_text(self.make_state())

        assert result.quiz[0].question == "Soal?"
        assert [route for _, route, _ in scripted_llm.calls] == ["context_summary", "quiz_generation"]

    def test_a_malformed_quiz_escalates_to_thinking(self, scripted_llm, pipeline_io):
        scripted_llm.reply("flash", "ringkasan", '{"quiz": "salah"}').reply("thinking", json.dumps(QUIZ))

        result = generate_quiz_pipeline.analyze_text(self.make_state())

        assert len(result.quiz) == 1
        assert [mode for mode, _, _ in scripted_llm.calls] == ["flash", "flash", "thinking"]

    def test_total_quiz_failure_returns_an_empty_quiz_not_invented_questions(self, scripted_llm, pipeline_io):
        scripted_llm.reply("flash", "ringkasan").fail("flash").fail("thinking")

        result = generate_quiz_pipeline.analyze_text(self.make_state())

        assert result.quiz == []
