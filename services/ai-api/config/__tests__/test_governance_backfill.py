from __future__ import annotations

import json
from types import SimpleNamespace

from config.governance_backfill import backfill_outline_governance, ensure_payload_indexes
from config.retrieval_governance import FILTERED_FIELDS


def node_content(metadata):
    return json.dumps({"id_": "n", "text": "isi", "metadata": metadata, "class_name": "TextNode"})


def point(point_id, topic_id, chunk_index=0, **extra):
    metadata = {"source": f"golden:{topic_id}", "chunk_index": chunk_index, "topic_id": topic_id, "source_kind": "golden-graph"}
    payload = {**metadata, **extra, "_node_content": node_content(metadata), "_node_type": "TextNode"}
    return SimpleNamespace(id=point_id, payload=payload)


class FakeQdrant:
    def __init__(self, points, indexed=()):
        self.points = {p.id: p for p in points}
        self.indexed = set(indexed)
        self.created: list[tuple[str, object]] = []
        self.set_calls = 0

    def scroll(self, collection_name, scroll_filter=None, limit=100, offset=None, with_payload=True, with_vectors=False):
        self.last_filter = scroll_filter
        ordered = [p for p in self.points.values() if p.payload.get("source_kind") == "golden-graph"]
        start = ordered.index(next(p for p in ordered if p.id == offset)) if offset is not None else 0
        batch = ordered[start : start + limit]
        following = ordered[start + limit].id if start + limit < len(ordered) else None
        return batch, following

    def set_payload(self, collection_name, payload, points, wait=True):
        self.set_calls += 1
        for pid in points:
            self.points[pid].payload.update(payload)

    def get_collection(self, name):
        return SimpleNamespace(payload_schema={field: object() for field in self.indexed})

    def create_payload_index(self, collection_name, field_name, field_schema=None, wait=True):
        self.indexed.add(field_name)
        self.created.append((field_name, field_schema))


def test_every_golden_chunk_gets_the_governance_keys_in_the_payload_and_in_the_node_content():
    client = FakeQdrant([point(1, "l1-t01-accounting-equation"), point(2, "l1-t02-debits-credits", chunk_index=1)])

    report = backfill_outline_governance(client, "reducera-embedding")

    first = client.points[1].payload
    assert first["status"] == "PUBLISHED" and first["access_scope"] == "PLATFORM" and first["domain_id"] == "ACCOUNTING"
    assert first["concept_ids"] == ["l1-t01-accounting-equation"]
    assert first["chunk_id"] == "golden:l1-t01-accounting-equation:0"
    assert client.points[2].payload["chunk_id"] == "golden:l1-t02-debits-credits:1"
    inner = json.loads(first["_node_content"])["metadata"]
    assert inner["status"] == "PUBLISHED" and inner["concept_ids"] == ["l1-t01-accounting-equation"] and inner["chunk_id"] == first["chunk_id"]
    assert inner["source"] == "golden:l1-t01-accounting-equation"
    assert (report.seen, report.updated, report.unchanged) == (2, 2, 0)


def test_a_second_run_changes_nothing():
    client = FakeQdrant([point(1, "c1"), point(2, "c2")])
    backfill_outline_governance(client, "reducera-embedding")
    calls = client.set_calls

    report = backfill_outline_governance(client, "reducera-embedding")

    assert client.set_calls == calls
    assert (report.seen, report.updated, report.unchanged) == (2, 0, 2)


def test_only_golden_graph_points_are_read_and_other_points_are_left_alone():
    other = SimpleNamespace(id=9, payload={"source": "r-1", "source_kind": "resource"})
    client = FakeQdrant([point(1, "c1"), other])

    report = backfill_outline_governance(client, "reducera-embedding")

    assert "status" not in other.payload
    assert report.seen == 1
    flt = client.last_filter.model_dump(exclude_none=True)
    assert flt["must"][0] == {"key": "source_kind", "match": {"value": "golden-graph"}}


def test_it_pages_through_all_points():
    client = FakeQdrant([point(i, f"c{i}") for i in range(1, 8)])

    report = backfill_outline_governance(client, "reducera-embedding", page_size=3)

    assert report.seen == 7 and report.updated == 7


def test_a_point_without_a_topic_id_is_reported_and_not_touched():
    broken = SimpleNamespace(id=5, payload={"source": "golden:x", "chunk_index": 0, "source_kind": "golden-graph", "_node_content": node_content({})})
    client = FakeQdrant([broken, point(1, "c1")])

    report = backfill_outline_governance(client, "reducera-embedding")

    assert report.skipped == [5] and report.updated == 1
    assert "status" not in broken.payload


def test_a_dry_run_reports_what_it_would_do_and_writes_nothing():
    client = FakeQdrant([point(1, "c1")])

    report = backfill_outline_governance(client, "reducera-embedding", dry_run=True)

    assert report.updated == 1 and client.set_calls == 0 and "status" not in client.points[1].payload


def test_the_payload_indexes_for_the_filtered_fields_are_created_once():
    client = FakeQdrant([], indexed={"status"})

    created = ensure_payload_indexes(client, "reducera-embedding")

    assert set(created) == set(FILTERED_FIELDS) - {"status"}
    assert {field for field, _ in client.created} == set(created)
    assert ensure_payload_indexes(client, "reducera-embedding") == []
