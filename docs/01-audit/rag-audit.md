# RAG Audit — Ingestion, Retrieval, Grounding, Defense

> **Status**: `stable` · **Owner**: `ml-lead` · **Last reviewed**: `2026-10-09`
>
> Whether retrieved material reaches the tutor, whether it is scoped, and whether untrusted content is contained.

---

## Scope

Embedding and chunking, the Qdrant collections, chunk metadata, retrieval filters and their callers, citations, prompt-level trust fences, URL allow-listing, and web search. The live Qdrant instance was queried read-only on 2026-10-09.

## Findings

### Pipeline components

| Feature | Status | Source | Evidence / notes |
|---|---|---|---|
| Remote embeddings (`BAAI/bge-m3`, 1024 dims) | `IMPLEMENTED` | `services/ai-api/config/embedding_pipeline.py`; `HF_*` in `.env` | `reducera-embedding` holds 65 points of size 1024, cosine |
| Collection dimension guard | `IMPLEMENTED` | `services/ai-api/config/vector_collections.py:13-19` | refuses to start on a vector-size mismatch |
| Chunk upsert | `PARTIAL` | `embedding_pipeline.py:200-232` writes `source = source_id`, `chunk_index`, then caller metadata | `source` is a per-document id, not a category |
| Golden-graph ingestion | `IMPLEMENTED` as an operator script | `services/ai-api/scripts/ingest_golden_graph.py` | 65 chunks, all `source_kind=golden-graph` |
| Resource ingestion | `BROKEN` | `services/ai-api/v1/resources/workers.py:49-65`; api `knowledge.processor.ts` | the queue to ai-api needs `AI_URL` (H-001); PDF URLs are all blocked (M-014); the whole resource record minus five keys becomes chunk payload (`:55-58`) |
| Retrieval | `BROKEN` | `embedding_pipeline.py:234-262`; callers `content_pipeline.py:237`, `learning/service.py:281` | C-002 |
| Citations | `PARTIAL` | `content_pipeline.py:246-266` builds `CitationDto` for results with score > 0 | `lesson_id` falls back to the current lesson when the chunk has no `lessonId` (`:257`), so a citation can name a lesson the chunk is not from; with retrieval returning nothing, citation lists are empty |
| Fences around retrieved and tool text | `IMPLEMENTED` | `services/ai-api/config/prompt_segmentation.py:69-110` (`segment_retrieved`, `segment_tool_output`, `segment_user_input`, `neutralize_fences`) | untrusted blocks are labelled data; used on both paths |
| Instruction-injection defense at five boundaries (upload, extraction, embedding, retrieval, rendering) | `PARTIAL` | extraction: URL allow-list; retrieval: none; rendering: fences; memory write and web results: `looks_like_instruction` (`utils/tools/web_search.py:35-37`, `utils/tools/memory.py:87`) | no filter at embedding time or on retrieved chunks |
| Web search | `PARTIAL` | `services/ai-api/utils/tools/web_search.py:12-47` | M-015 |

### Required chunk metadata

| Field | Golden-graph chunks | Resource chunks |
|---|---|---|
| `tenant_id` | absent (0 of 65, `must_not is_empty` count) | not added by ai-api |
| `resource_id` | absent | `source` carries the resource id |
| `chunk_id` | `chunk_index` only | `chunk_index` only |
| `status` | absent | whatever the api resource record contains |
| `access_scope` | absent | not added |
| `version` | absent | not added |
| `domain_id` | absent | absent |
| `concept_id` | `topic_id` (api id space) | absent |

Filtered retrieval before prompt assembly is a stated requirement; no caller passes a tenant, user, entitlement, status or domain filter.

### C-002

**The tutor's retrieval filter matches nothing.** Both live callers pass `metadata_filter={"source": "material"}` (`content_pipeline.py:237`, `learning/service.py:281`). `retrieve()` turns it into a LlamaIndex `MetadataFilter(key="metadata.source", …)` (`embedding_pipeline.py:252`). Two independent defects each force an empty result:

| Defect | Evidence |
|---|---|
| The key is nested (`metadata.source`) but the stored payload is flat (`source`, `chunk_index`, `topic_id`, … at top level) | sample points from `POST /collections/reducera-embedding/points/scroll` |
| The value `"material"` is never written: `upsert_document` sets `source` to the document id (`golden:<topicId>` or a resource id) | `embedding_pipeline.py:216`; `scripts/ingest_golden_graph.py:57-69` |

Live counts on `reducera-embedding` (read-only `points/count`): no filter 65; `metadata.source == "material"` **0**; `source == "material"` **0**; `source_kind == "golden-graph"` 65; points with a `tenant_id` field 0. In production the prompt therefore contains `[No RAG materials available]` (`learning/service.py:354`) or an empty retrieved block, and the citation list is empty. Prior documents record "live retrieval returns semantically correct top-3 hits" (`docs/01-audit/system-scorecard.md` §1); that check did not pass the production filter. Note the memory store uses unprefixed keys (`userId`) that match its flat payload (`config/memory_embedding.py:88-96`), which is the convention retrieval should follow.

Tests: the learning tests patch `pipeline.retrieve` or the router, so no test runs a real filtered query; status `UNVERIFIED` by tests, `BROKEN` by the live count.

### M-014

**The URL allow-list cannot be configured.** `UrlAllowList` reads `RESOURCE_ALLOWLIST_HOSTS`, `_SCHEMES` and `_LOCAL` from `ENVS` (`services/ai-api/config/url_allowlist.py:35-60`), but `config/envs.py` defines none of those keys, so `ENVS.get(...)` is always `None`. With all three variables exported, `UrlAllowList()` still has `allowed_hosts = set()` and `allow_local = False`, and neither `https://cdn.example.com/x.pdf` nor `http://localhost/x` is allowed. `extract_pdf` calls `assert_url_allowed` first (`services/ai-api/v1/resources/service.py:112-118`), so every PDF-URL extraction is refused in every environment. The SSRF defense fails closed, which is the safe direction, and the feature it protects is dead. `.env` does not define the variables either (they appear only in `.env.example:100-102`).

### M-015

**Web search is off without notice and discloses queries when on.** `TAVILY_API_KEY` is empty in `.env` (length 0), so the request carries an empty `api_key`, Tavily answers non-200, and the tool logs an error and returns `""` (`web_search.py:21-27`). The chat path calls it on every message (`learning/service.py:292`) and the material path on every generation (`content_pipeline.py:299`), each with a 10 s timeout, regardless of whether RAG found anything. When a key is present, the learner's topic and query leave the system for a third party on each call; no setting disables it per tenant or per learner.

## Evidence citations

- `services/ai-api/config/embedding_pipeline.py:200-262`; `services/ai-api/config/prompt_segmentation.py:58-110,191`
- `services/ai-api/v1/learning/content_pipeline.py:227-269,299`; `services/ai-api/v1/learning/service.py:256-360`
- `services/ai-api/config/url_allowlist.py`; `services/ai-api/config/envs.py` (no `RESOURCE_ALLOWLIST_*`)
- `services/ai-api/scripts/ingest_golden_graph.py:57-69`
- Qdrant, 2026-10-09: `GET /collections/reducera-embedding` (65 points); `points/count` with the four filters above; `points/scroll` payload keys

## Verdict

Embedding, storage and prompt fencing work. Retrieval does not: the one filter used in production matches no stored chunk, the stored chunks carry none of the governance metadata (tenant, status, access scope, version, domain), and no caller filters by user or entitlement. The system currently produces ungrounded tutor text with an empty citation list, and the two supplementary sources (PDF URLs, web search) are respectively blocked and disabled. Scoped, filtered retrieval has to be built, not repaired.
