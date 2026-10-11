# Scoped Retrieval with Governance Metadata

> **Status**: `stable` · **Owner**: `ml-lead` · **Last reviewed**: `2026-10-10`
>
> How every chunk written to the vector store carries the metadata that says who may see it, and how every retrieval is filtered by that metadata before any text reaches a prompt.

Decision source: finding C-002 and audit row 4a of [rag-audit.md](../01-audit/rag-audit.md) and [implementation-readiness.md](../01-audit/implementation-readiness.md); ADR-009 (chunks refer to api concept ids). Decision record: [ADR-016](../decisions/ADR-016-scoped-retrieval.md). Tasks: [scoped-retrieval-plan.md](../plans/scoped-retrieval-plan.md). Concept ids come from [learner-state-and-concept-registry.md](./learner-state-and-concept-registry.md).

---

## Purpose

Defines the chunk metadata contract (version 1), the write guard that refuses a chunk without it, the retrieval scope and the Qdrant filter built from it, the two-stage concept search, the backfill of the 65 chunks already stored, and the citation fields.

Out of scope, each with its owner decision:

| Not covered | Why | Tracked as |
|---|---|---|
| Tenant membership based access (`TENANT` scope) | `ai-api` does not know memberships; the filter supports a list of tenant ids and no caller passes one until `api` returns them | follow-up of H-012 |
| Private learner uploads (`OWNER` scope) | the contract and filter support it and are tested; no upload flow writes it yet | product decision |
| Resource ingestion that cannot run (queue, URL allow-list, M-014) | separate defects of the ingestion path; this design only gives its chunks governance | M-014, H-001 |
| Web search and Tavily (M-015) | not a vector store matter | M-015 |
| Instruction-injection filtering of retrieved chunks | fences exist at rendering; a filter at embedding time is a separate defense | rag-audit "five boundaries" |
| The quality of the 65 outline chunks as a knowledge base | they hold title, description and prerequisites only | content authoring |

## Research

Sources read on 2026-10-10.

| Source | What it says | Consequence for this design |
|---|---|---|
| [Qdrant, Filtering](https://qdrant.tech/documentation/concepts/filtering/) (first 100000 of 112075 characters read) | `must` is AND, `should` is OR, `must_not` is NOT; a filter with `must` and `should` returns records that satisfy all `must` conditions and at least one `should` condition; `Match Any` matches one of several values on a field; `is_empty` matches a missing, null or empty field; "create payload indexes for the fields you plan to filter on", best before ingesting | The access rule is built as `must: [status, domain, (should: platform OR owner OR tenant)]`, a nested filter, not a chain of `should` at the top, so the OR cannot weaken the `must` conditions. Concept scoping uses `Match Any` on the list field. A payload index is created for each filtered field |
| [OWASP LLM08:2025, Vector and Embedding Weaknesses](https://docs.bytehide.com/products/radar/sast/owasp/llm08-2025) (found by search, secondary page, the OWASP original was not opened) | vector stores need the same access control as any database; retrieval can leak across permission boundaries and accept poisoned entries; mitigations are fine-grained, permission-aware retrieval, validated ingestion and logs of retrieval | A chunk cannot be written without governance metadata, a retrieval cannot run without a scope, and each retrieval logs the scope and the chunk ids it returned, never the text |
| [rag-audit.md](../01-audit/rag-audit.md) | the production filter `metadata.source == "material"` matches 0 of 65 chunks; no chunk has tenant, status, scope, version or domain; no caller filters by user | the contract below and the filter replace the single dead filter |

## Current state

Measured on 2026-10-10 on the running stack.

| # | Fact | Evidence | Consequence |
|---|---|---|---|
| 1 | `reducera-embedding` holds 65 points of size 1024; each payload has `source`, `chunk_index`, `topic_id`, `level_*`, `prerequisites`, `source_kind=golden-graph` and the LlamaIndex `_node_content`; no governance key | scroll of one point; rag-audit counts | the backfill adds the keys |
| 2 | `topic_id` of those chunks equals the id of a `Concept` of the registry (`l1-t01-accounting-equation`) | `scripts/ingest_golden_graph.py`, `seed-data/golden-accounting-graph.json`, ADR-014 | no id mapping is needed; `concept_ids = [topic_id]` |
| 3 | Four callers retrieve: material generation and chat (both with the dead filter), step planning and quiz generation (no filter). Quiz generation also writes the learner's own LLM summary into the same collection (`doc_kind=learner-summary`) and reads it back, so with no filter it was readable by every other learner | grep `retrieve(`, `generate_quiz_pipeline.py` | all four get a scope; the summary is written as `OWNER` content |
| 4 | `retrieve` prefixes filter keys with `metadata.`, which a flat Qdrant payload does not have | `embedding_pipeline.py` | the new filter is a native Qdrant filter on flat keys |
| 5 | `Resource` has no owner field; resources are curriculum material attached to a topic, sub-topic, lesson or step and uploaded by teachers or admins | `schema.prisma`, `resources.controller.ts` | resource chunks are `PLATFORM` content; `OWNER` stays reserved |
| 6 | A citation names `state.lesson_id` when the chunk has no `lessonId` | `content_pipeline.py` | citations carry the chunk's own concept, lesson and resource ids and are never filled from the current lesson |

## Conceptual model

```
write:  content + Governance  -->  upsert_document  -->  chunk payload (flat keys, contract v1)   [refuses without Governance]
read:   query + RetrievalScope -->  build_qdrant_filter --> Qdrant search --> chunks + log of ids  [refuses without a scope]
```

Invariants:

1. **No governance, no write.** `upsert_document` takes a validated `Governance` and writes its keys on every chunk.
2. **No scope, no read.** `retrieve` takes a `RetrievalScope` with an actor and a domain. There is no unfiltered mode.
3. **Published and visible only.** Every filter requires `status == PUBLISHED` and the access rule.
4. **The filter is code, not text.** It is built from typed fields; a concept id or a query string cannot add a condition.
5. **Concept scoping narrows, never widens.** It is applied on top of the mandatory conditions.
6. **Ids in, ids out.** A retrieval logs actor, domain, scope kind, count and chunk ids; the learner's query text and the chunk text are not logged.

## Metadata contract v1

Flat payload keys, next to the existing ones (`source`, `chunk_index`, `source_kind`, `topic_id`, ...), which stay for compatibility.

| Key | Type | Required | Meaning |
|---|---|---|---|
| `schema_version` | int | yes | `1` |
| `doc_kind` | `concept-outline`, `resource` or `learner-summary` | yes | what the chunk comes from |
| `domain_id` | string | yes | `ACCOUNTING` |
| `status` | `PUBLISHED`, `DRAFT` or `ARCHIVED` | yes | only `PUBLISHED` is retrievable |
| `access_scope` | `PLATFORM`, `TENANT` or `OWNER` | yes | who may see it |
| `owner_id` | string | when `OWNER` | the learner who may see it |
| `tenant_id` | string | when `TENANT` | the tenant whose members may see it |
| `concept_ids` | list of strings | yes, may be empty | api `Concept` ids the chunk is about |
| `chunk_id` | string | yes | `{source}:{chunk_index}`, stable for citations |
| `resource_id`, `lesson_id`, `topic_id`, `sub_topic_id`, `step_id` | string | no | location in the curriculum, when known |

The `_node_content` JSON that LlamaIndex stores holds the same metadata, because retrieval results are rebuilt from it; the backfill updates both.

## Algorithms

### Retrieval filter

```
must:
  status == PUBLISHED
  domain_id == scope.domain_id
  filter(should):
    access_scope == PLATFORM
    filter(must): access_scope == OWNER, owner_id == scope.actor_id
    filter(must): access_scope == TENANT, tenant_id any-of scope.tenant_ids      (only when tenant_ids is not empty)
  concept_ids any-of scope.concept_ids                                           (only when concept scoping is on)
```

### Two-stage concept search

1. If the scope has concept ids, search with the concept condition, `top_k` results.
2. If fewer than `MIN_CONCEPT_RESULTS` (3) came back, search again without the concept condition and append the results whose chunk id was not returned yet, up to `top_k` in total, concept hits first. The outline knowledge base is thin, so a lesson with one linked concept would otherwise ground on one chunk.
3. A scope without concept ids runs stage 2 only.

### Where the concept ids come from

`api` resolves them: the material pipeline and the chat prompt already read `GET /internal/learner-state`, whose `concepts` are the approved concepts of the lesson or user step (ADR-014). The retrieval helper takes the ids from the same call. When the call fails the scope has no concept ids and retrieval is domain wide.

### Backfill of the stored chunks

`scripts/backfill_governance_metadata.py` scrolls the points with `source_kind == golden-graph`, builds the governance keys (`doc_kind=concept-outline`, `domain_id=ACCOUNTING`, `status=PUBLISHED`, `access_scope=PLATFORM`, `concept_ids=[topic_id]`, `chunk_id`), merges them into the top-level payload and into `_node_content.metadata`, and writes them with `set_payload`. It needs no embedding call, is idempotent, and reports the counts before and after. It also creates the payload indexes.

### Write guard

`Governance` validates on construction: enums, `OWNER` needs `owner_id`, `TENANT` needs `tenant_id`, `concept_ids` is a list of strings. `upsert_document(content, source_id, metadata, governance)` merges `governance.payload(chunk_index, source_id)` over the caller's metadata, so a caller cannot override a governance key.

### Failure of the embedding provider

The query is embedded by the remote gateway before the search. A failure of the gateway or of the store is raised as `RetrievalError` (the reason class only, not the provider message). Callers degrade: the material pipeline and the chat prompt continue without materials (the existing "no RAG materials" path), the introduction skips the step, the quiz is built from the summary. Writes (`upsert_document`) are not degraded: a chunk that cannot be embedded is not stored.

### Citations

A citation carries `chunk_id`, `concept_id` (first of the chunk's `concept_ids`), `lesson_id` and `resource_id` only when the chunk has them, the score, the source label and a snippet. `CitationDto` accepts a citation only when it names at least one of lesson, concept or resource, so a bare label is still refused. A chunk with no locator is used as context and not cited. Nothing is filled from the current lesson; the web already renders a citation without a lesson link.

## Trade-offs

| Option | Verdict |
|---|---|
| A. Fix the key prefix and the value of the old filter only | rejected: it repairs a filter that has no meaning (`source == material`) and keeps every chunk visible to everyone |
| B. One collection per tenant or per scope | not chosen: the platform content would be duplicated and the filter on one collection with indexes is the documented pattern |
| C. Filter after retrieval in Python | rejected: top-k would be taken before the filter, so the allowed results can be crowded out, and forbidden text would already be in memory |
| D. Let the caller build the filter | rejected: the access rule must live in one tested place |
| E. Re-embed everything with new metadata | not needed: `set_payload` changes metadata without changing vectors |
| F. Make `concept_ids` a hard filter | rejected: with 65 outline chunks a lesson would often get one result; the two-stage search keeps the concept first and the domain as support |
| G. Store `tenant_ids` of all members on the chunk | not chosen: membership changes would require rewriting chunks; the tenant is checked against the caller's list at read time |

Residual risks: the 65 chunks hold little text, so grounding is shallow until content is ingested; the `TENANT` and `OWNER` paths are tested but have no writer; a payload index is a Qdrant setting that must exist on every environment (the backfill and the collection guard create it).

## Migration notes

- **Order**: governance and scope modules, then the write guard and the retrieval, then the four callers and the citation fields, then the backfill run on the live collection, then verification. Until the backfill runs the new filter returns nothing, so the backfill runs in the same deploy, before traffic.
- **Rollback**: the payload keys are additive; the previous image ignores them. Restoring the image restores the old (dead) filter.
- **Data**: nothing is deleted or re-embedded.

## Verification

Run on 2026-10-10 against the live dev stack.

| Check | Result |
|---|---|
| `services/ai-api` `uv run pytest -q` | 756 passed (675 before) |
| Mutants killed | status condition dropped, access rule widened to the top level, governance override order reversed, de-duplication removed, second stage reusing the concept condition |
| Production-like filter on `reducera-embedding`, before the backfill | `status == PUBLISHED` matched 0 of 65 points (the old `metadata.source == "material"` filter 0) |
| Backfill on the live collection: dry run, real run, second run | 65 seen and 65 updated, then 65 seen and 0 updated 65 unchanged; payload indexes already created by the new startup guard |
| After | `status`, `domain_id` and `access_scope` filter matches 65; `concept_ids` any of `l1-t03-journal-entries` matches 1; `metadata.source == "material"` still 0 |
| Retrieval through the pipeline with the stored vector of the journal chunk as the query vector (the embedding gateway was out of credits, see below) | domain wide 5 results; concept scoped returns `golden:l1-t03-journal-entries:0` first and fills to 5 from the domain; another domain 0; returned metadata carries `status`, `access_scope`, `domain_id`, `concept_ids`, `chunk_id`, `doc_kind` |
| Isolation with four temporary points (owned by A and published, draft, archived, owned by B and published) | actor A saw only A's, actor B only B's, a third actor none; draft and archived were seen by nobody; the points were deleted (65 points remain) |
| Material generation in the worker with the real retrieval path | the embedding call failed with 402, the failure was logged as an error and as a retrieval warning, and the lesson was still generated by the Mistral gateway (3698 characters, no citations) |

Found while verifying: the Hugging Face token of the dev environment has **no remaining credits** (the router answers `402 You have no remaining credits`). Every query embedding and every chunk write fails until the owner adds credits or changes the embedding provider; this is why the live retrieval check used a stored vector. The semantic quality of retrieval (does the embedding of "jurnal umum" find the journal chunk) was therefore not verified here. Before the change the same outage made material generation raise in retrieval; after it, generation degrades.

Not verified: a real embedding query, the `TENANT` scope (no caller passes tenant ids), the resource ingestion path end to end (the queue and the URL allow-list defects remain), and the learner summary write while the gateway is down (it raises and the quiz task retries).

## Evidence citations

- `services/ai-api/config/embedding_pipeline.py` (`upsert_document`, `retrieve`), `config/vector_collections.py`, `scripts/ingest_golden_graph.py`
- `services/ai-api/v1/learning/content_pipeline.py` (`retrieve_material_rag`), `v1/learning/service.py` (`get_propmpt_material`), `v1/users_steps/service.py:136`, `v1/users_steps/generate_quiz_pipeline.py:99`, `v1/resources/workers.py`
- `services/api/prisma/schema.prisma` (`Resource`, `Concept`), `services/api/prisma/seed-data/golden-accounting-graph.json`
- Live Qdrant, 2026-10-10: `GET /collections/reducera-embedding/points/scroll` (payload keys of one point)
