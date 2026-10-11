from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

from qdrant_client.models import FieldCondition, Filter, MatchValue, PayloadSchemaType

from config.retrieval_governance import FILTERED_FIELDS
from v1.domain.governance import outline_governance

logger = logging.getLogger(__name__)

OUTLINE_KIND = "golden-graph"


@dataclass
class BackfillReport:
    seen: int = 0
    updated: int = 0
    unchanged: int = 0
    skipped: list[Any] = field(default_factory=list)


def _merged_node_content(raw: Any, governance: dict[str, Any]) -> str | None:
    try:
        node = json.loads(raw)
    except (TypeError, ValueError):
        return None
    metadata = node.setdefault("metadata", {})
    metadata.update(governance)
    return json.dumps(node)


def backfill_outline_governance(client, collection: str, *, page_size: int = 100, dry_run: bool = False) -> BackfillReport:
    report = BackfillReport()
    offset = None
    outline = Filter(must=[FieldCondition(key="source_kind", match=MatchValue(value=OUTLINE_KIND))])

    while True:
        records, offset = client.scroll(
            collection_name=collection,
            scroll_filter=outline,
            limit=page_size,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for record in records:
            report.seen += 1
            payload = record.payload or {}
            concept_id = payload.get("topic_id")
            source = payload.get("source")
            chunk_index = payload.get("chunk_index")
            if not (concept_id and source and chunk_index is not None):
                report.skipped.append(record.id)
                continue

            governance = outline_governance(concept_id).payload(source, chunk_index)
            node_content = _merged_node_content(payload.get("_node_content"), governance)
            if node_content is None:
                report.skipped.append(record.id)
                continue

            wanted = {**governance, "_node_content": node_content}
            if all(payload.get(key) == value for key, value in wanted.items() if key != "_node_content") and json.loads(
                payload.get("_node_content")
            ) == json.loads(node_content):
                report.unchanged += 1
                continue

            report.updated += 1
            if not dry_run:
                client.set_payload(collection_name=collection, payload=wanted, points=[record.id], wait=True)
        if offset is None:
            break

    logger.info(
        "[BACKFILL] seen=%d updated=%d unchanged=%d skipped=%d dry_run=%s",
        report.seen,
        report.updated,
        report.unchanged,
        len(report.skipped),
        dry_run,
    )
    return report


def ensure_payload_indexes(client, collection: str) -> list[str]:
    existing = set((client.get_collection(collection).payload_schema or {}).keys())
    created: list[str] = []
    for name in FILTERED_FIELDS:
        if name in existing:
            continue
        client.create_payload_index(collection_name=collection, field_name=name, field_schema=PayloadSchemaType.KEYWORD, wait=True)
        created.append(name)
    return created
