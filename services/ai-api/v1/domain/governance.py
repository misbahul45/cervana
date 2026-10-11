from __future__ import annotations

from typing import Any, Mapping

from config.retrieval_governance import Governance, GovernanceError, RetrievalScope

DEFAULT_DOMAIN = "ACCOUNTING"


def outline_governance(concept_id: str) -> Governance:
    return Governance(
        doc_kind="concept-outline",
        domain_id=DEFAULT_DOMAIN,
        status="PUBLISHED",
        access_scope="PLATFORM",
        concept_ids=(concept_id,),
        topic_id=concept_id,
    )


def resource_governance(record: Mapping[str, Any]) -> Governance:
    resource_id = record.get("id")
    if not isinstance(resource_id, str) or not resource_id:
        raise GovernanceError("a resource record needs an id")
    return Governance(
        doc_kind="resource",
        domain_id=DEFAULT_DOMAIN,
        status="PUBLISHED",
        access_scope="PLATFORM",
        resource_id=resource_id,
        lesson_id=record.get("lessonId") or None,
        topic_id=record.get("topicId") or None,
        sub_topic_id=record.get("subTopicId") or None,
        step_id=record.get("stepId") or None,
    )


def learner_summary_governance(owner_id: str, *, topic_id: str | None, lesson_id: str | None) -> Governance:
    return Governance(
        doc_kind="learner-summary",
        domain_id=DEFAULT_DOMAIN,
        status="PUBLISHED",
        access_scope="OWNER",
        owner_id=owner_id,
        topic_id=topic_id or None,
        lesson_id=lesson_id or None,
    )


def retrieval_scope(actor_id: str, snapshot: Mapping[str, Any] | None = None) -> RetrievalScope:
    concepts = (snapshot or {}).get("concepts")
    ids: list[str] = []
    if isinstance(concepts, list):
        for item in concepts:
            concept_id = item.get("conceptId") if isinstance(item, dict) else None
            if isinstance(concept_id, str) and concept_id and concept_id not in ids:
                ids.append(concept_id)
    return RetrievalScope(actor_id=actor_id, domain_id=DEFAULT_DOMAIN, concept_ids=tuple(ids))
