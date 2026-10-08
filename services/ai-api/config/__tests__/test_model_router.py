from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from config.model_router import (
    DEFAULT_TASK_MODES,
    ModelRouter,
    OutcomeLog,
    RoutingPolicy,
    estimate_complexity,
)
from errors.types import LLMError


class ScriptedModel:
    def __init__(self, *steps):
        self.steps = list(steps)
        self.calls = 0

    def invoke(self, messages, **kwargs):
        self.calls += 1
        step = self.steps.pop(0)
        if isinstance(step, Exception):
            raise step
        return step


class Factory:
    def __init__(self, flash=None, thinking=None):
        self.models = {"flash": flash, "thinking": thinking}
        self.requests = []

    def __call__(self, mode, route=None):
        self.requests.append((mode, route))
        return self.models[mode]


def policy(**overrides):
    base = dict(version="routing-v1", task_modes=dict(DEFAULT_TASK_MODES))
    base.update(overrides)
    return RoutingPolicy(**base)


def router(factory, **policy_overrides):
    return ModelRouter(policy(**policy_overrides), model_factory=factory)


MESSAGES = [HumanMessage(content="Jelaskan jurnal penyesuaian")]


class TestComplexity:
    def test_a_short_question_is_simple(self):
        assert estimate_complexity("Apa itu debit?") < 0.3

    def test_long_multi_part_input_with_tools_and_context_is_complex(self):
        query = "Bandingkan metode FIFO dan rata-rata, hitung dampaknya pada laba, lalu jelaskan jurnal koreksinya. " * 4

        assert estimate_complexity(query, tool_count=3, context_chars=9000, history_turns=8) > 0.7

    def test_the_score_is_bounded_and_deterministic(self):
        huge = "x " * 50000
        first = estimate_complexity(huge, tool_count=99, context_chars=10**7, history_turns=500)

        assert first == estimate_complexity(huge, tool_count=99, context_chars=10**7, history_turns=500)
        assert 0.0 <= first <= 1.0
        assert estimate_complexity("") == 0.0


class TestDecide:
    def test_documented_tasks_map_to_their_documented_modes(self):
        r = router(Factory())

        assert r.decide("tutor_reply", query="halo").mode == "flash"
        assert r.decide("hint", query="halo").mode == "flash"
        assert r.decide("quiz_generation", query="halo").mode == "flash"
        assert r.decide("free_text_judge", query="halo").mode == "flash"
        assert r.decide("lesson_content", query="halo").mode == "thinking"
        assert r.decide("path_planning", query="halo").mode == "thinking"
        assert r.decide("scenario_drafting", query="halo").mode == "thinking"

    def test_an_unknown_task_uses_the_default_mode(self):
        assert router(Factory(), default_mode="flash").decide("mystery", query="x").mode == "flash"

    def test_a_complex_flash_task_is_promoted_to_thinking(self):
        r = router(Factory(), escalate_above=0.5)

        decision = r.decide("tutor_reply", query="x", complexity=0.8)

        assert decision.mode == "thinking"
        assert "complexity" in decision.reason

    def test_a_simple_thinking_task_is_never_demoted(self):
        decision = router(Factory(), escalate_above=0.5).decide("lesson_content", query="x", complexity=0.0)

        assert decision.mode == "thinking"

    def test_the_decision_carries_the_policy_version(self):
        assert router(Factory()).decide("hint", query="x").policy_version == "routing-v1"


class TestInvoke:
    def test_returns_clean_text_and_the_route_is_the_task_name(self):
        flash = ScriptedModel(AIMessage(content=[{"type": "thinking", "thinking": "rahasia"}, {"type": "text", "text": "Jawaban."}]))
        factory = Factory(flash=flash)

        result = router(factory).invoke("tutor_reply", MESSAGES, query="Apa itu debit?")

        assert result.text == "Jawaban."
        assert (result.mode, result.escalated) == ("flash", False)
        assert factory.requests == [("flash", "tutor_reply")]

    def test_a_flash_failure_escalates_once_to_thinking(self):
        flash = ScriptedModel(RuntimeError("gateway down"))
        thinking = ScriptedModel(AIMessage(content="Jawaban dalam."))

        result = router(Factory(flash, thinking)).invoke("tutor_reply", MESSAGES, query="x")

        assert result.text == "Jawaban dalam."
        assert (result.mode, result.escalated) == ("thinking", True)
        assert [a.mode for a in result.attempts] == ["flash", "thinking"]
        assert result.attempts[0].ok is False

    def test_a_rejected_flash_answer_escalates(self):
        flash = ScriptedModel(AIMessage(content="ngawur"))
        thinking = ScriptedModel(AIMessage(content="benar"))

        result = router(Factory(flash, thinking)).invoke(
            "quiz_generation", MESSAGES, query="x", validator=lambda text: text == "benar"
        )

        assert (result.text, result.escalated) == ("benar", True)

    def test_an_empty_answer_counts_as_a_failure(self):
        flash = ScriptedModel(AIMessage(content="   "))
        thinking = ScriptedModel(AIMessage(content="isi"))

        result = router(Factory(flash, thinking)).invoke("hint", MESSAGES, query="x")

        assert result.text == "isi"

    def test_escalation_can_be_switched_off_by_policy(self):
        flash = ScriptedModel(RuntimeError("down"))

        with pytest.raises(LLMError) as raised:
            router(Factory(flash, ScriptedModel()), allow_failure_escalation=False).invoke("hint", MESSAGES, query="x")

        assert raised.value.details["attempts"][0]["mode"] == "flash"

    def test_the_escalation_budget_caps_thinking_calls(self):
        flash = ScriptedModel(RuntimeError("down"))
        thinking = ScriptedModel()

        with pytest.raises(LLMError):
            router(Factory(flash, thinking), max_escalations=0).invoke("hint", MESSAGES, query="x")

        assert thinking.calls == 0

    def test_both_modes_failing_raises_a_typed_error_without_leaking_the_cause(self):
        flash = ScriptedModel(RuntimeError("sk-secret-token leaked"))
        thinking = ScriptedModel(RuntimeError("also sk-secret-token"))

        with pytest.raises(LLMError) as raised:
            router(Factory(flash, thinking)).invoke("hint", MESSAGES, query="x")

        assert "sk-secret-token" not in str(raised.value.details)
        assert len(raised.value.details["attempts"]) == 2

    def test_a_thinking_task_is_not_downgraded_when_it_fails(self):
        flash = ScriptedModel()
        thinking = ScriptedModel(RuntimeError("down"))

        with pytest.raises(LLMError):
            router(Factory(flash, thinking)).invoke("lesson_content", MESSAGES, query="x")

        assert flash.calls == 0

    def test_outcomes_are_recorded_for_the_fast_loop(self):
        log = OutcomeLog(capacity=10)
        flash = ScriptedModel(RuntimeError("down"))
        thinking = ScriptedModel(AIMessage(content="ok"))
        r = ModelRouter(policy(), model_factory=Factory(flash, thinking), outcomes=log)

        r.invoke("tutor_reply", MESSAGES, query="x", complexity=0.4)

        recorded = log.snapshot()
        assert len(recorded) == 1
        assert (recorded[0].task, recorded[0].first_mode, recorded[0].final_mode) == ("tutor_reply", "flash", "thinking")
        assert (recorded[0].escalated, recorded[0].ok, recorded[0].complexity) == (True, True, 0.4)

    def test_the_outcome_log_is_bounded(self):
        log = OutcomeLog(capacity=2)
        r = ModelRouter(policy(), model_factory=Factory(ScriptedModel(*[AIMessage(content="a")] * 3)), outcomes=log)

        for _ in range(3):
            r.invoke("hint", MESSAGES, query="x")

        assert len(log.snapshot()) == 2


class TestStringPrompt:
    def test_a_plain_string_prompt_is_sent_as_one_human_message(self):
        seen = []

        class Recorder(ScriptedModel):
            def invoke(self, messages, **kwargs):
                seen.append(messages)
                return super().invoke(messages, **kwargs)

        result = router(Factory(flash=Recorder(AIMessage(content="ok")))).invoke("hint", "Jelaskan debit", query="Jelaskan debit")

        assert result.text == "ok"
        assert [type(m) for m in seen[0]] == [HumanMessage]
        assert seen[0][0].content == "Jelaskan debit"

    def test_the_newer_utility_tasks_are_flash(self):
        r = router(Factory())

        for task in ("learner_analysis", "context_summary", "translation", "personality_quiz"):
            assert r.decide(task, query="x").mode == "flash"
