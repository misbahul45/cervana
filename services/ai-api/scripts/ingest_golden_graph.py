from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ingest-golden-graph")


def compose_content(topic: dict, level_title: str) -> str:
    parts: list[str] = []
    parts.append(f"# {topic['title']}")
    parts.append("")
    parts.append(f"Domain: {level_title}")
    parts.append("")
    parts.append("## Description")
    parts.append(topic.get("description", "").strip() or "(no description)")
    parts.append("")
    if topic.get("prerequisites"):
        parts.append("## Prerequisites")
        parts.append(", ".join(topic["prerequisites"]))
        parts.append("")
    parts.append("## Estimated Study Time")
    parts.append(f"{topic.get('estimatedMinutes', 30)} minutes")
    parts.append("")
    parts.append("## Topic ID")
    parts.append(topic["id"])
    return "\n".join(parts).strip() + "\n"


def main() -> int:
    path = Path("/tmp/golden-accounting-graph.json")
    if not path.exists():
        log.error("Missing /tmp/golden-accounting-graph.json; copy it in first")
        return 2

    payload = json.loads(path.read_text())
    levels = payload.get("levels", [])
    log.info(f"Loaded golden graph: {len(levels)} levels")

    from config.embedding_pipeline import get_embedding_pipeline

    pipeline = get_embedding_pipeline()
    total_topics = 0
    total_chunks = 0
    failures: list[str] = []
    started = time.time()

    for level in levels:
        level_title = level["title"]
        for topic in level["topics"]:
            total_topics += 1
            content = compose_content(topic, level_title)
            source_id = f"golden:{topic['id']}"
            metadata = {
                "level_id": level["id"],
                "level_title": level_title,
                "topic_id": topic["id"],
                "topic_title": topic["title"],
                "prerequisites": topic.get("prerequisites", []),
                "estimated_minutes": topic.get("estimatedMinutes", 30),
                "source_kind": "golden-graph",
            }
            try:
                before = _qdrant_count()
                pipeline.upsert_document(content=content, source_id=source_id, metadata=metadata)
                after = _qdrant_count()
                delta = max(0, after - before)
                total_chunks += delta
                log.info(f"[{total_topics:>2}/{sum(len(l['topics']) for l in levels)}] {topic['id']:<40} chunks+={delta} (qdrant total {after})")
            except Exception as e:
                log.exception(f"[fail] {topic['id']}: {e}")
                failures.append(topic["id"])

    elapsed = time.time() - started
    final = _qdrant_count()
    log.info("=" * 60)
    log.info(f"Total topics: {total_topics}")
    log.info(f"Successful:   {total_topics - len(failures)}")
    log.info(f"Failed:       {len(failures)}")
    if failures:
        log.info(f"  -> {', '.join(failures)}")
    log.info(f"Chunks added: {total_chunks}")
    log.info(f"Qdrant total: {final}")
    log.info(f"Elapsed:      {elapsed:.1f}s")
    return 0 if not failures else 1


def _qdrant_count() -> int:
    from config.embedding_pipeline import qdrant_client, COLLECTION_NAME
    try:
        info = qdrant_client.get_collection(COLLECTION_NAME)
        return int(info.points_count or 0)
    except Exception as e:
        log.debug(f"qdrant count failed: {e}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
