from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass(frozen=True)
class StageEvent:
    key: str
    state: str
    data: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> str:
        return json.dumps({"key": self.key, "state": self.state, "data": self.data}, ensure_ascii=False)


def chunk_text(chunk: Any) -> Optional[str]:
    if isinstance(chunk, StageEvent):
        return None
    if hasattr(chunk, "delta") and chunk.delta:
        text = chunk.delta
    elif hasattr(chunk, "text") and chunk.text:
        text = chunk.text
    elif hasattr(chunk, "content") and chunk.content:
        text = chunk.content
    else:
        text = chunk

    if callable(text):
        text = text()
    if text is None:
        return None
    if not isinstance(text, str):
        text = str(text)
    return text or None
