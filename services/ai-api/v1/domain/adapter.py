from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable

from config.agent_session import AgentSession
from config.internal_client import InternalApiClient
from errors.types import CrossServiceError

PYTHON_SCHEME = "PYTHON_DOMAIN"
DEFAULT_TTL_SECONDS = 300

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _Snapshot:
    order: tuple[str, ...]
    titles: dict[str, str]
    aliases: dict[str, tuple[str, ...]]
    reverse: dict[str, tuple[str, ...]]


def _parse(data: Any) -> _Snapshot:
    if not isinstance(data, dict) or not isinstance(data.get("concepts"), list):
        raise ValueError("concepts missing")
    order: list[str] = []
    titles: dict[str, str] = {}
    for concept in data["concepts"]:
        concept_id = concept["id"]
        order.append(concept_id)
        titles[concept_id] = str(concept.get("title", concept_id))

    raw_aliases = (data.get("aliases") or {}).get(PYTHON_SCHEME) or {}
    if not isinstance(raw_aliases, dict):
        raise ValueError("aliases malformed")
    position = {concept_id: index for index, concept_id in enumerate(order)}
    aliases = {
        alias: tuple(sorted((t for t in targets if t in titles), key=lambda t: position[t]))
        for alias, targets in raw_aliases.items()
    }
    reverse: dict[str, list[str]] = {}
    for alias, targets in aliases.items():
        for target in targets:
            reverse.setdefault(target, []).append(alias)
    return _Snapshot(
        order=tuple(order),
        titles=titles,
        aliases={alias: targets for alias, targets in aliases.items() if targets},
        reverse={target: tuple(sorted(names)) for target, names in reverse.items()},
    )


class ConceptCatalog:
    def __init__(self, *, ttl_seconds: int = DEFAULT_TTL_SECONDS, clock: Callable[[], float] = time.monotonic):
        self._ttl = ttl_seconds
        self._clock = clock
        self._snapshot: _Snapshot | None = None
        self._loaded_at = 0.0
        self._lock = threading.Lock()

    def load(self, session: AgentSession) -> None:
        with self._lock:
            if self._snapshot is not None and self._clock() - self._loaded_at < self._ttl:
                return
            try:
                data = InternalApiClient(session).get("/internal/concepts")
                snapshot = _parse(data)
            except CrossServiceError:
                if self._snapshot is not None:
                    logger.warning("[CONCEPT_CATALOG] refresh failed, serving the cached registry")
                    return
                raise
            except (ValueError, KeyError, TypeError) as exc:
                if self._snapshot is not None:
                    logger.warning("[CONCEPT_CATALOG] refresh returned a malformed registry, serving the cached one")
                    return
                raise CrossServiceError(
                    "internal api returned a malformed concept registry",
                    details={"error": str(exc)},
                ) from exc
            self._snapshot = snapshot
            self._loaded_at = self._clock()

    def resolve(self, any_id: str) -> list[str]:
        snapshot = self._snapshot
        if snapshot is None or not any_id:
            return []
        if any_id in snapshot.titles:
            return [any_id]
        return list(snapshot.aliases.get(any_id, ()))

    def python_ids_for(self, concept_id: str) -> list[str]:
        snapshot = self._snapshot
        return list(snapshot.reverse.get(concept_id, ())) if snapshot else []

    def title_of(self, concept_id: str) -> str | None:
        snapshot = self._snapshot
        return snapshot.titles.get(concept_id) if snapshot else None


def fetch_learner_state(
    session: AgentSession,
    *,
    lesson_id: str | None = None,
    concept_id: str | None = None,
    user_step_id: str | None = None,
) -> dict:
    params = {
        key: value
        for key, value in (("lessonId", lesson_id), ("conceptId", concept_id), ("userStepId", user_step_id))
        if value
    }
    return InternalApiClient(session).get("/internal/learner-state", params=params)


_catalog = ConceptCatalog()


def get_concept_catalog() -> ConceptCatalog:
    return _catalog


__all__ = ["ConceptCatalog", "fetch_learner_state", "get_concept_catalog", "PYTHON_SCHEME"]
