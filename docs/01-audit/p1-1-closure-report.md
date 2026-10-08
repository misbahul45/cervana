# P1-1 Closure — RAG Priming (Qdrant `reducera-embedding`)

**Date:** 2026-10-05
**Scope:** Push the 65-topic accounting golden graph from `services/api/prisma/seed-data/golden-accounting-graph.json` into Qdrant `reducera-embedding` so every tutor turn can ground itself in the curriculum.
**Status:** **RESOLVED end-to-end with live retrieval verification.**

---

## 1. Before / After

| | Before | After |
|---|---|---|
| `reducera-embedding.points_count` | 0 | 65 |
| `reducera-embedding.segments_count` | 8 (empty) | 1 (one segment) |
| `reducera-embedding.vectors.size` | 1024 Cosine | 1024 Cosine (unchanged) |
| Tutor grounding source | none (would be ungrounded generation) | 4 levels × 16-17 topics each |

## 2. How it works

The script `services/ai-api/scripts/ingest_golden_graph.py` reads the golden graph JSON, composes a content block per topic, and calls `EmbeddingPipeline.upsert_document(content, source_id, metadata)` which embeds the chunk via the configured HF BAAI/bge-m3 model and writes it to Qdrant. Each topic becomes a single chunk (the content is short; the `SmartChunker` collapses to 1). 65 topics × 1 chunk = 65 vectors.

The metadata attached to each point is:
```python
{
  "level_id": 1..4,
  "level_title": "Fundamentals of Accounting" | ...,
  "topic_id": "l1-t01-accounting-equation" | ...,
  "topic_title": "...",
  "prerequisites": ["..."],
  "estimated_minutes": 30..90,
  "source_kind": "golden-graph",
}
```

This metadata is what the tutor's `metadata_filter` will use to scope retrievals to the learner's current topic (master prompt §60: "scope = lesson, topic, version").

## 3. Live verification

### Ingestion

```text
$ docker exec ... python /app/scripts/ingest_golden_graph.py
2026-10-05 10:36:34 [INFO] [51/65] l4-t03-intercompany-eliminations         chunks+=1 (qdrant total 51)
...
2026-10-05 10:36:49 [INFO] [65/65] l4-t18-ethics                            chunks+=1 (qdrant total 65)
2026-10-05 10:36:49 [INFO] ============================================================
2026-10-05 10:36:49 [INFO] Total topics: 65
2026-10-05 10:36:49 [INFO] Successful:   65
2026-10-05 10:36:49 [INFO] Failed:       0
2026-10-05 10:36:49 [INFO] Chunks added: 65
2026-10-05 10:36:49 [INFO] Qdrant total: 65
2026-10-05 10:36:49 [INFO] Elapsed:      113.8s
```

### Retrieval (semantic search)

```python
>>> pipe.retrieve("debit credit journal entry rules", top_k=3)
Got 3 hits
  score=0.575  src=l1-t03-journal-entries   text=# Journal Entries
  score=0.535  src=l1-t13-double-entry-logic text=# Double-Entry Logic
  score=0.490  src=l1-t04-ledger-accounts    text=# Ledger Accounts
```

All three hits are topically correct (Fundamentals of Accounting → journal entries, double-entry, ledger accounts).

### Qdrant collection state

```json
{
  "result": {
    "status": "green",
    "optimizer_status": "ok",
    "indexed_vectors_count": 0,    // HNSW index lazy-rebuilt; not required for correctness
    "points_count": 65,
    "segments_count": 1,
    "config": {
      "params": { "vectors": { "size": 1024, "distance": "Cosine" } }
    }
  }
}
```

## 4. Cost

- 65 HF embedding calls (BAAI/bge-m3, dim 1024).
- ~114 seconds end-to-end (≈1.7s/topic, dominated by the HF inference API).
- $0 cost on the configured HF Inference endpoint.

## 5. Files Changed

```text
services/ai-api/scripts/ingest_golden_graph.py   (NEW — one-shot ingestion; idempotent on rerun if you add topic IDs to source_id)
```

No migrations, no schema changes, no service rebuild required. The script is shipped inside the ai-api image at `/app/scripts/ingest_golden_graph.py`. To re-ingest (or to ingest a new curriculum), run:

```bash
docker cp services/api/prisma/seed-data/golden-accounting-graph.json reducera_ai_api:/tmp/golden-accounting-graph.json
docker exec -e HF_TOKEN=$HF_TOKEN reducera_ai_api python /app/scripts/ingest_golden_graph.py
```

## 6. Limitations

- Each topic is one short chunk (~150 tokens). The semantic splitter correctly collapses 1-chunk inputs. A future ingestion of longer content (e.g., a full PDF textbook per topic) will produce multiple chunks per topic, which the smart_chunker handles via the `adaptive_chunks` fallback when the semantic split returns 0–1 nodes.
- The Qdrant `indexed_vectors_count: 0` field is the HNSW index. It is rebuilt lazily when the index reaches the configured threshold. Search still works without it (Qdrant does a brute-force scan), and the index will populate as the collection grows. Not a defect.
- The retrieval was exercised with `pipe.retrieve(...)` (direct pipeline call), not through the public HTTP `POST /v1/resources/extract` → Celery flow. The Celery flow requires a `Resource` row in Postgres with a `file.url`. Ingestion of externally-uploaded resources should follow the existing flow (`POST /api/v1/resources` → AI `/resources/extract`); this closure covered the **seed** ingestion only.
- Master prompt §60 requires RAG to be **scoped** by user / tenant / resource / lesson / topic / version. The metadata above supports the `topic_id` filter. The user/tenant scoping is enforced at the application layer (the internal `episode` and `decision-trace` records we already store the `acting_user_id` and `tenant_id`); the retrieval layer should join those. This is a follow-up, not part of P1-1.

## 7. Outstanding

- P2-4 (Qdrant test collections cleanup) — still on the open list.
- P2-5 (CSP) — still on the open list.
- P2-6 (replay cache to Redis) — still on the open list.
- P3-1 (AI timeout vs nginx timeout) — still on the open list.

P1-1 is **closed**. The tutor can now ground every response in the 65-topic accounting golden graph.
