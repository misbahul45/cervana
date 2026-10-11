from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from qdrant_client.models import FieldCondition, Filter, MatchAny, MatchValue

CONTRACT_VERSION = 1
DOC_KINDS = frozenset({"concept-outline", "resource", "learner-summary"})
STATUSES = frozenset({"PUBLISHED", "DRAFT", "ARCHIVED"})
ACCESS_SCOPES = frozenset({"PLATFORM", "TENANT", "OWNER"})
PUBLISHED = "PUBLISHED"
FILTERED_FIELDS = (
    "status",
    "domain_id",
    "access_scope",
    "owner_id",
    "tenant_id",
    "concept_ids",
    "source_kind",
)


class GovernanceError(ValueError):
    pass


def _text(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value:
        raise GovernanceError(f"{name} must be a non-empty string")
    return value


def _texts(value: Any, name: str) -> tuple[str, ...]:
    if isinstance(value, (str, bytes)) or not isinstance(value, (list, tuple)) or not all(isinstance(v, str) and v for v in value):
        raise GovernanceError(f"{name} must be a list of non-empty strings")
    return tuple(value)


@dataclass(frozen=True)
class Governance:
    doc_kind: str
    domain_id: str
    status: str
    access_scope: str
    concept_ids: tuple[str, ...] = ()
    owner_id: str | None = None
    tenant_id: str | None = None
    resource_id: str | None = None
    lesson_id: str | None = None
    topic_id: str | None = None
    sub_topic_id: str | None = None
    step_id: str | None = None

    def __post_init__(self) -> None:
        if self.doc_kind not in DOC_KINDS:
            raise GovernanceError(f"doc_kind must be one of {sorted(DOC_KINDS)}")
        if self.status not in STATUSES:
            raise GovernanceError(f"status must be one of {sorted(STATUSES)}")
        if self.access_scope not in ACCESS_SCOPES:
            raise GovernanceError(f"access_scope must be one of {sorted(ACCESS_SCOPES)}")
        _text(self.domain_id, "domain_id")
        object.__setattr__(self, "concept_ids", _texts(self.concept_ids, "concept_ids"))
        if self.access_scope == "OWNER":
            _text(self.owner_id, "owner_id")
        if self.access_scope == "TENANT":
            _text(self.tenant_id, "tenant_id")

    def payload(self, source_id: str, chunk_index: int) -> dict[str, Any]:
        values: dict[str, Any] = {
            "schema_version": CONTRACT_VERSION,
            "doc_kind": self.doc_kind,
            "domain_id": self.domain_id,
            "status": self.status,
            "access_scope": self.access_scope,
            "concept_ids": list(self.concept_ids),
            "chunk_id": f"{source_id}:{chunk_index}",
        }
        for key in ("owner_id", "tenant_id", "resource_id", "lesson_id", "topic_id", "sub_topic_id", "step_id"):
            value = getattr(self, key)
            if value:
                values[key] = value
        return values


@dataclass(frozen=True)
class RetrievalScope:
    actor_id: str
    domain_id: str
    concept_ids: tuple[str, ...] = field(default_factory=tuple)
    tenant_ids: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        _text(self.actor_id, "actor_id")
        _text(self.domain_id, "domain_id")
        object.__setattr__(self, "concept_ids", _texts(self.concept_ids, "concept_ids"))
        object.__setattr__(self, "tenant_ids", _texts(self.tenant_ids, "tenant_ids"))

    def without_concepts(self) -> "RetrievalScope":
        return RetrievalScope(self.actor_id, self.domain_id, (), self.tenant_ids)


def _equals(key: str, value: str) -> FieldCondition:
    return FieldCondition(key=key, match=MatchValue(value=value))


def _any_of(key: str, values: tuple[str, ...]) -> FieldCondition:
    return FieldCondition(key=key, match=MatchAny(any=list(values)))


def build_qdrant_filter(scope: RetrievalScope) -> Filter:
    access = [
        _equals("access_scope", "PLATFORM"),
        Filter(must=[_equals("access_scope", "OWNER"), _equals("owner_id", scope.actor_id)]),
    ]
    if scope.tenant_ids:
        access.append(Filter(must=[_equals("access_scope", "TENANT"), _any_of("tenant_id", scope.tenant_ids)]))

    must: list[Any] = [_equals("status", PUBLISHED), _equals("domain_id", scope.domain_id), Filter(should=access)]
    if scope.concept_ids:
        must.append(_any_of("concept_ids", scope.concept_ids))
    return Filter(must=must)


__all__ = [
    "CONTRACT_VERSION",
    "FILTERED_FIELDS",
    "Governance",
    "GovernanceError",
    "RetrievalScope",
    "build_qdrant_filter",
]
