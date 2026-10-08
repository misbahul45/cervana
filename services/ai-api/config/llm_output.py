from __future__ import annotations

import json
from typing import Any, Callable, Type

from pydantic import BaseModel, ValidationError


def strip_code_fence(text: str) -> str:
    cleaned = (text or "").strip()
    if not cleaned.startswith("```"):
        return cleaned
    lines = [line for line in cleaned.split("\n") if not line.strip().startswith("```")]
    return "\n".join(lines).strip()


def parse_json_object(text: str) -> dict[str, Any]:
    try:
        value = json.loads(strip_code_fence(text))
    except json.JSONDecodeError as exc:
        raise ValueError("output is not valid JSON") from exc
    if not isinstance(value, dict):
        raise ValueError("output is not a JSON object")
    return value


def json_validator(model: Type[BaseModel] | None = None) -> Callable[[str], bool]:
    def validate(text: str) -> bool:
        try:
            payload = parse_json_object(text)
            if model is not None:
                model.model_validate(payload)
        except (ValueError, ValidationError):
            return False
        return True

    return validate
