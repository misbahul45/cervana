from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from config import providers
from config.envs import ENVS
from config.providers import HuggingFaceEmbedding, resolve_embedding_endpoint

DIM = 4


def make_embedding(token="hf-test", dimensions=DIM):
    return HuggingFaceEmbedding(
        model_name="org/model",
        endpoint="https://hf.example/models/org/model",
        token=token,
        dimensions=dimensions,
    )


def response(status=200, payload=None):
    result = MagicMock()
    result.status_code = status
    result.json.return_value = payload
    return result


def test_endpoint_template_substitutes_model():
    url = resolve_embedding_endpoint(
        "https://router.example/models/{model}/pipeline/feature-extraction", "org/model"
    )
    assert url == "https://router.example/models/org/model/pipeline/feature-extraction"


def test_dedicated_endpoint_without_placeholder_is_unchanged():
    assert resolve_embedding_endpoint("https://dedicated.example/", "org/model") == "https://dedicated.example/"


def test_batch_uses_single_request_and_bearer_token():
    matrix = np.arange(2 * DIM, dtype=float).reshape(2, DIM).tolist()
    with patch.object(providers.requests, "post", return_value=response(200, matrix)) as post:
        vectors = make_embedding()._get_text_embeddings(["a", "b"])

    assert len(vectors) == 2 and len(vectors[0]) == DIM
    assert post.call_count == 1
    assert post.call_args.kwargs["json"] == {"inputs": ["a", "b"]}
    assert post.call_args.kwargs["headers"] == {"Authorization": "Bearer hf-test"}


def test_empty_batch_makes_no_request():
    with patch.object(providers.requests, "post") as post:
        assert make_embedding()._get_text_embeddings([]) == []
    post.assert_not_called()


def test_token_level_output_is_mean_pooled():
    tokens = np.ones((1, 3, DIM)).tolist()
    with patch.object(providers.requests, "post", return_value=response(200, tokens)):
        vector = make_embedding()._get_query_embedding("q")

    assert vector == [1.0] * DIM


def test_dimension_mismatch_is_rejected():
    matrix = np.zeros((1, DIM + 1)).tolist()
    with patch.object(providers.requests, "post", return_value=response(200, matrix)):
        with pytest.raises(RuntimeError, match="EMBEDDING_DIM"):
            make_embedding()._get_text_embedding("x")


def test_missing_token_fails_before_any_request():
    with patch.object(providers.requests, "post") as post:
        with pytest.raises(RuntimeError, match="HF_TOKEN"):
            make_embedding(token="")._get_text_embedding("x")
    post.assert_not_called()


def test_transient_status_is_retried_then_succeeds():
    ok = response(200, np.zeros((1, DIM)).tolist())
    with patch.object(providers.requests, "post", side_effect=[response(503), ok]) as post, patch.object(
        providers.time, "sleep"
    ):
        make_embedding()._get_text_embedding("x")

    assert post.call_count == 2


def test_client_error_is_not_retried():
    with patch.object(providers.requests, "post", return_value=response(401)) as post, patch.object(
        providers.time, "sleep"
    ):
        with pytest.raises(RuntimeError, match="401"):
            make_embedding()._get_text_embedding("x")

    assert post.call_count == 1


def test_retries_are_bounded():
    with patch.object(providers.requests, "post", return_value=response(503)) as post, patch.object(
        providers.time, "sleep"
    ):
        with pytest.raises(RuntimeError, match="attempts"):
            make_embedding()._get_text_embedding("x")

    assert post.call_count == providers.MAX_ATTEMPTS


def test_error_payload_is_rejected():
    with patch.object(providers.requests, "post", return_value=response(200, {"error": "loading"})):
        with pytest.raises(RuntimeError, match="error payload"):
            make_embedding()._get_text_embedding("x")


def set_chat_env(monkeypatch, temperature=None):
    monkeypatch.setitem(ENVS, "OPENAI_API_KEY", "sk-test")
    monkeypatch.setitem(ENVS, "OPENAI_BASE_URL", "https://llm.example/v1")
    monkeypatch.setitem(ENVS, "OPENAI_MODEL_FLASH", "fast-model")
    monkeypatch.setitem(ENVS, "OPENAI_MODEL_THINKING", "deep-model")
    monkeypatch.setitem(ENVS, "OPENAI_MAX_TOKENS", 321)
    monkeypatch.setitem(ENVS, "OPENAI_THINKING_MAX_TOKENS", 4321)
    monkeypatch.setitem(ENVS, "OPENAI_FLASH_TEMPERATURE", temperature)


def test_flash_is_the_default_mode_and_uses_flash_settings(monkeypatch):
    set_chat_env(monkeypatch)

    chat = providers.build_chat_model()

    assert chat.model_name == "fast-model"
    assert chat.openai_api_base == "https://llm.example/v1"
    assert chat.max_tokens == 321
    assert chat.temperature is None


def test_thinking_mode_uses_thinking_model_and_larger_token_budget(monkeypatch):
    set_chat_env(monkeypatch)

    chat = providers.build_chat_model("thinking")

    assert chat.model_name == "deep-model"
    assert chat.openai_api_base == "https://llm.example/v1"
    assert chat.max_tokens == 4321


def test_flash_temperature_is_applied_only_when_configured(monkeypatch):
    set_chat_env(monkeypatch, temperature=0.2)

    assert providers.build_chat_model("flash").temperature == 0.2


def test_thinking_mode_never_sends_a_temperature(monkeypatch):
    set_chat_env(monkeypatch, temperature=0.2)

    assert providers.build_chat_model("thinking").temperature is None


def test_embedding_model_reads_environment(monkeypatch):
    monkeypatch.setitem(ENVS, "HF_EMBEDDING_MODEL", "org/other")
    monkeypatch.setitem(ENVS, "HF_EMBEDDING_URL", "https://router.example/{model}/fe")
    monkeypatch.setitem(ENVS, "HF_TOKEN", "hf-x")
    monkeypatch.setitem(ENVS, "EMBEDDING_DIM", 8)

    model = providers.build_embedding_model()

    assert model.endpoint == "https://router.example/org/other/fe"
    assert model.dimensions == 8
    assert model.token == "hf-x"
