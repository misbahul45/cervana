from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field, replace
from typing import Any, Callable, Mapping

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_mistralai import ChatMistralAI
from langchain_openai import ChatOpenAI

from config.envs import ENVS

logger = logging.getLogger("llm_registry")

LLM_TIMEOUT_SECONDS = 60
LLM_MAX_RETRIES = 2
MODES = ("flash", "thinking")
ROUTE_KEYS = frozenset({"provider", "mode", "model", "max_tokens", "temperature"})


class LLMConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class ModelSpec:
    provider: str
    model: str
    mode: str
    max_tokens: int
    temperature: float | None
    base_url: str
    api_key: str = field(default="", repr=False)
    timeout: int = LLM_TIMEOUT_SECONDS
    max_retries: int = LLM_MAX_RETRIES


ProviderFactory = Callable[[ModelSpec], BaseChatModel]


def _openai_model(spec: ModelSpec) -> BaseChatModel:
    options: dict[str, Any] = {}
    if spec.temperature is not None:
        options["temperature"] = spec.temperature
    return ChatOpenAI(
        api_key=spec.api_key,
        base_url=spec.base_url,
        model=spec.model,
        max_tokens=spec.max_tokens,
        request_timeout=spec.timeout,
        timeout=spec.timeout,
        max_retries=spec.max_retries,
        **options,
    )


def _mistral_model(spec: ModelSpec) -> BaseChatModel:
    options: dict[str, Any] = {}
    if spec.temperature is not None:
        options["temperature"] = spec.temperature
    return ChatMistralAI(
        model=spec.model,
        mistral_api_key=spec.api_key,
        endpoint=spec.base_url,
        max_tokens=spec.max_tokens,
        timeout=spec.timeout,
        max_retries=spec.max_retries,
        **options,
    )


_PROVIDERS: dict[str, ProviderFactory] = {
    "openai": _openai_model,
    "mistral": _mistral_model,
}
_CACHE: dict[ModelSpec, BaseChatModel] = {}


def register_provider(name: str, factory: ProviderFactory) -> None:
    _PROVIDERS[name.strip().lower()] = factory
    _CACHE.clear()


def registered_providers() -> tuple[str, ...]:
    return tuple(sorted(_PROVIDERS))


def parse_routes(raw: str | None) -> dict[str, dict[str, Any]]:
    if not raw or not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMConfigError(f"LLM_ROUTES is not valid JSON: {exc.msg}") from exc
    if not isinstance(parsed, dict):
        raise LLMConfigError("LLM_ROUTES must be a JSON object keyed by route name")
    for name, entry in parsed.items():
        if not isinstance(entry, dict):
            raise LLMConfigError(f"LLM_ROUTES route '{name}' must be an object")
        unknown = set(entry) - ROUTE_KEYS
        if unknown:
            raise LLMConfigError(
                f"LLM_ROUTES route '{name}' has unsupported keys: {', '.join(sorted(unknown))}"
            )
    return parsed


def _defaults(provider: str, mode: str, env: Mapping[str, Any]) -> dict[str, Any]:
    thinking = mode == "thinking"
    if provider == "mistral":
        return {
            "model": env["MISTRAL_MODEL_THINKING" if thinking else "MISTRAL_MODEL_FLASH"],
            "max_tokens": env["MISTRAL_THINKING_MAX_TOKENS" if thinking else "MISTRAL_MAX_TOKENS"],
            "temperature": env["MISTRAL_THINKING_TEMPERATURE" if thinking else "MISTRAL_FLASH_TEMPERATURE"],
            "base_url": env["MISTRAL_BASE_URL"],
            "api_key": env["MISTRAL_API_KEY"],
        }
    return {
        "model": env["OPENAI_MODEL_THINKING" if thinking else "OPENAI_MODEL_FLASH"],
        "max_tokens": env["OPENAI_THINKING_MAX_TOKENS" if thinking else "OPENAI_MAX_TOKENS"],
        "temperature": None if thinking else env["OPENAI_FLASH_TEMPERATURE"],
        "base_url": env["OPENAI_BASE_URL"],
        "api_key": env["OPENAI_API_KEY"],
    }


def resolve_spec(
    mode: str = "flash",
    route: str | None = None,
    env: Mapping[str, Any] | None = None,
) -> ModelSpec:
    env = ENVS if env is None else env
    override = parse_routes(env.get("LLM_ROUTES")).get(route) if route else None
    override = override or {}

    provider = str(override.get("provider") or env.get("LLM_PROVIDER") or "openai").strip().lower()
    if provider not in _PROVIDERS:
        raise LLMConfigError(
            f"unknown LLM provider '{provider}'; registered: {', '.join(registered_providers())}"
        )

    effective_mode = str(override.get("mode") or mode)
    if effective_mode not in MODES:
        raise LLMConfigError(f"unknown LLM mode '{effective_mode}'; expected one of {', '.join(MODES)}")

    values = _defaults(provider, effective_mode, env)
    for key in ("model", "max_tokens", "temperature"):
        if key in override:
            values[key] = override[key]

    return ModelSpec(provider=provider, mode=effective_mode, **values)


def _build(spec: ModelSpec) -> BaseChatModel:
    if spec.provider in ("openai", "mistral") and not spec.api_key:
        logger.warning("no API key configured for provider '%s'; LLM calls will fail", spec.provider)
    return _PROVIDERS[spec.provider](spec)


def build_chat_model(
    mode: str = "flash",
    route: str | None = None,
    env: Mapping[str, Any] | None = None,
) -> BaseChatModel:
    return _build(resolve_spec(mode, route, env))


def get_chat_model(
    mode: str = "flash",
    route: str | None = None,
    env: Mapping[str, Any] | None = None,
) -> BaseChatModel:
    spec = resolve_spec(mode, route, env)
    if spec not in _CACHE:
        _CACHE[spec] = _build(spec)
    return _CACHE[spec]


def clear_model_cache() -> None:
    _CACHE.clear()


def message_text(message: Any) -> str:
    content = getattr(message, "content", message)
    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
        return "".join(parts).strip()
    return str(content).strip()


__all__ = [
    "LLMConfigError",
    "ModelSpec",
    "build_chat_model",
    "clear_model_cache",
    "get_chat_model",
    "message_text",
    "parse_routes",
    "register_provider",
    "registered_providers",
    "resolve_spec",
]
