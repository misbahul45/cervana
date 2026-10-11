from __future__ import annotations

from typing import Any, Optional


def chunk_text(chunk: Any) -> Optional[str]:
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
