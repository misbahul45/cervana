from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import AIMessage
from langchain_mistralai import ChatMistralAI
from langchain_openai import ChatOpenAI

from config import llm_registry
from config.llm_registry import (
    LLMConfigError,
    ModelSpec,
    build_chat_model,
    get_chat_model,
    message_text,
    parse_routes,
    register_provider,
    resolve_spec,
)

BASE_ENV = {
    "LLM_PROVIDER": "openai",
    "LLM_ROUTES": "",
    "OPENAI_API_KEY": "sk-openai",
    "OPENAI_BASE_URL": "https://gateway.example/v1",
    "OPENAI_MODEL_FLASH": "flash-model",
    "OPENAI_MODEL_THINKING": "think-model",
    "OPENAI_MAX_TOKENS": 4096,
    "OPENAI_THINKING_MAX_TOKENS": 12000,
    "OPENAI_FLASH_TEMPERATURE": None,
    "MISTRAL_API_KEY": "mk-test",
    "MISTRAL_BASE_URL": "https://api.mistral.ai/v1",
    "MISTRAL_MODEL_FLASH": "mistral-small-latest",
    "MISTRAL_MODEL_THINKING": "magistral-medium-latest",
    "MISTRAL_MAX_TOKENS": 6000,
    "MISTRAL_THINKING_MAX_TOKENS": 14000,
    "MISTRAL_FLASH_TEMPERATURE": 0.3,
    "MISTRAL_THINKING_TEMPERATURE": 0.7,
}


def env(**overrides):
    return {**BASE_ENV, **overrides}


class TestResolveSpec:
    def test_defaults_to_the_openai_compatible_gateway(self):
        spec = resolve_spec("flash", env=env())

        assert (spec.provider, spec.model, spec.mode) == ("openai", "flash-model", "flash")
        assert spec.base_url == "https://gateway.example/v1"
        assert spec.max_tokens == 4096
        assert spec.temperature is None

    def test_thinking_mode_never_carries_a_temperature_for_the_gateway(self):
        spec = resolve_spec("thinking", env=env(OPENAI_FLASH_TEMPERATURE=0.2))

        assert spec.model == "think-model"
        assert spec.max_tokens == 12000
        assert spec.temperature is None

    def test_mistral_provider_uses_the_mistral_defaults(self):
        flash = resolve_spec("flash", env=env(LLM_PROVIDER="mistral"))
        thinking = resolve_spec("thinking", env=env(LLM_PROVIDER="mistral"))

        assert (flash.provider, flash.model, flash.max_tokens, flash.temperature) == ("mistral", "mistral-small-latest", 6000, 0.3)
        assert (thinking.model, thinking.max_tokens, thinking.temperature) == ("magistral-medium-latest", 14000, 0.7)
        assert flash.base_url == "https://api.mistral.ai/v1"
        assert flash.api_key == "mk-test"

    def test_a_route_can_switch_provider_and_model_per_task(self):
        routes = json.dumps({"tutor": {"provider": "mistral", "model": "mistral-large-latest", "max_tokens": 2048}})

        tutor = resolve_spec("flash", route="tutor", env=env(LLM_ROUTES=routes))
        other = resolve_spec("flash", route="quiz", env=env(LLM_ROUTES=routes))

        assert (tutor.provider, tutor.model, tutor.max_tokens) == ("mistral", "mistral-large-latest", 2048)
        assert (other.provider, other.model) == ("openai", "flash-model")

    def test_a_route_can_pick_the_thinking_mode(self):
        routes = json.dumps({"planner": {"mode": "thinking"}})

        spec = resolve_spec("flash", route="planner", env=env(LLM_ROUTES=routes))

        assert (spec.mode, spec.model) == ("thinking", "think-model")

    def test_an_unknown_provider_is_rejected_instead_of_falling_back(self):
        with pytest.raises(LLMConfigError, match="unknown LLM provider"):
            resolve_spec("flash", env=env(LLM_PROVIDER="skynet"))

    def test_invalid_route_json_fails_loudly(self):
        with pytest.raises(LLMConfigError, match="LLM_ROUTES"):
            parse_routes("{not json")

    def test_the_api_key_never_appears_in_the_repr(self):
        assert "mk-test" not in repr(resolve_spec("flash", env=env(LLM_PROVIDER="mistral")))


class TestBuildChatModel:
    def test_openai_provider_builds_a_langchain_openai_model(self):
        model = build_chat_model("flash", env=env())

        assert isinstance(model, ChatOpenAI)
        assert model.model_name == "flash-model"
        assert str(model.openai_api_base) == "https://gateway.example/v1"

    def test_mistral_provider_builds_a_langchain_mistral_model(self):
        model = build_chat_model("flash", env=env(LLM_PROVIDER="mistral"))

        assert isinstance(model, ChatMistralAI)
        assert model.model == "mistral-small-latest"
        assert model.max_tokens == 6000
        assert model.temperature == 0.3
        assert model.endpoint == "https://api.mistral.ai/v1"

    def test_models_are_cached_per_spec(self):
        first = get_chat_model("flash", env=env(LLM_PROVIDER="mistral"))
        second = get_chat_model("flash", env=env(LLM_PROVIDER="mistral"))
        other = get_chat_model("thinking", env=env(LLM_PROVIDER="mistral"))

        assert first is second
        assert first is not other

    def test_a_provider_registered_at_runtime_is_used_without_touching_the_registry(self):
        fake = FakeListChatModel(responses=["halo"])
        seen: list[ModelSpec] = []

        def factory(spec: ModelSpec):
            seen.append(spec)
            return fake

        register_provider("fake", factory)
        routes = json.dumps({"tutor": {"provider": "fake", "model": "scripted"}})

        model = build_chat_model("flash", route="tutor", env=env(LLM_ROUTES=routes))

        assert model is fake
        assert seen[0].model == "scripted"


class TestMessageText:
    def test_plain_string_content(self):
        assert message_text(AIMessage(content="  jawaban  ")) == "jawaban"

    def test_reasoning_blocks_keep_only_the_answer(self):
        blocks = [
            {"type": "thinking", "thinking": [{"type": "text", "text": "pikiran internal"}]},
            {"type": "text", "text": "Jawaban akhir."},
        ]

        assert message_text(AIMessage(content=blocks)) == "Jawaban akhir."

    def test_plain_strings_inside_a_list_are_joined(self):
        assert message_text(AIMessage(content=["a", {"type": "text", "text": "b"}])) == "ab"

    def test_empty_content_is_an_empty_string(self):
        assert message_text(AIMessage(content="")) == ""
        assert message_text(None) == ""
