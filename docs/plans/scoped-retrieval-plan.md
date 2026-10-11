# Scoped Retrieval — Implementation Plan

> **Status**: `stable` · **Owner**: `ml-lead` · **Last reviewed**: `2026-10-10`
>
> Ordered tasks that put governance metadata on every chunk and a scope on every retrieval.

Design: [scoped-retrieval.md](../architecture/scoped-retrieval.md). Decision: [ADR-016](../decisions/ADR-016-scoped-retrieval.md). Closes finding C-002 for the retrieval side and audit row 4a (the metadata contract and filtered retrieval).

---

## Objective

After this plan the production retrieval returns the stored chunks for the lesson's concepts, no chunk can be written without governance metadata, no retrieval can run without a scope, and a chunk that an actor may not see cannot be returned to that actor.

## Scope

| Service | Created | Edited |
|---|---|---|
| `services/ai-api` | `config/retrieval_governance.py`, `scripts/backfill_governance_metadata.py`, tests | `config/embedding_pipeline.py`, `config/vector_collections.py` (indexes), `v1/learning/{content_pipeline,service,dto}.py`, `v1/users_steps/{service,generate_quiz_pipeline}.py`, `v1/resources/workers.py`, `scripts/ingest_golden_graph.py` and the tests that patch `retrieve` |
| repo | none | `AGENTS.md`, `docs/progress-tracker.md`, memory |

Rules for every task: no comments in code or configuration; never `git add`, `commit` or `push`; each task starts with the failing test; recreate compose services with `--no-deps` and rebuild `celery-worker` too.

Baselines before this plan (2026-10-10): `services/ai-api` `uv run pytest -q` 675 passed; `services/api` `pnpm jest --ci --silent` 1421 passed; `scripts/check-ownership-rules.sh` PASS.

## Step-by-step

| ID | Task | Verify |
|---|---|---|
| IMPL-RG-01 | `retrieval_governance.py`: `Governance` (validation, `payload`), `RetrievalScope`, `build_qdrant_filter`. Spec first: every enum and requirement, the exact filter structure, the access rule cannot be widened by `concept_ids` or by hostile strings, tenant clause only with tenant ids, `Match Any` for lists | `uv run pytest -q config/__tests__/test_retrieval_governance.py` |
| IMPL-RG-02 | `EmbeddingPipeline`: `upsert_document` requires `Governance`; `retrieve` requires a `RetrievalScope`, passes the filter as `qdrant_filters`, runs the two-stage search, de-duplicates by chunk id, logs ids. Spec first with a fake index | `uv run pytest -q config/__tests__/test_embedding_pipeline.py` |
| IMPL-RG-03 | Callers: material pipeline and chat prompt (concept ids from the learner state call), step planning, quiz generation, resource worker, golden graph ingestion; citation fields. Specs first | `uv run pytest -q v1 config` |
| IMPL-RG-04 | Backfill script and payload indexes. Spec first with a fake Qdrant client: adds the keys to payload and `_node_content`, idempotent, leaves other points alone, reports counts | `uv run pytest -q scripts` or the spec path of the task |
| IMPL-RG-05 | Deploy and live: tag images, rebuild `ai-api` and `celery-worker`, run the backfill, count with the production filter (before 0), run a real retrieval through the pipeline with the embedding gateway, check scope isolation with a temporary point of another owner and a draft point, remove them | the checks of the list |
| IMPL-RG-06 | Docs: `AGENTS.md` rules, tracker row, memory | `grep -n "scoped retrieval" AGENTS.md` |

## Acceptance criteria

1. `upsert_document` without `Governance` and `retrieve` without a scope both raise before any call to the store.
2. On the live collection the filter used in production returns 65 chunks after the backfill (it returned 0), and a retrieval through the pipeline returns chunks of the lesson's concepts first.
3. A chunk with `status` other than `PUBLISHED`, a chunk of `OWNER` scope of another learner and a chunk of another domain are never returned (unit and live).
4. A citation never names a lesson, concept or resource that the chunk does not carry.
5. Suites pass, the ownership gate passes, the stack is healthy and the logs are clean.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| the filter matches nothing because a key or index is wrong | High | live count before and after, a unit test of the exact filter, a live retrieval |
| the backfill misses `_node_content` and results lack the metadata | Medium | the backfill updates both, and the live retrieval checks the returned metadata |
| deploy order leaves a window with an empty retrieval | Medium | backfill in the same deploy, before traffic; the empty case already existed |
| old callers outside the repo | Low | none known; the signature change fails loudly |

## Rollback

- Images before this change: `reducera-ai-api:pre-rg-20261010` and `reducera-celery-worker:pre-rg-20261010`.
- The payload keys and indexes are additive and can stay.

## Progress

| Task | Status | Evidence |
|---|---|---|
| IMPL-RG-01 | [x] | `config/retrieval_governance.py`, `v1/domain/governance.py`; 24 + 16 tests; two filter mutants killed |
| IMPL-RG-02 | [x] | `EmbeddingPipeline.upsert_document` (governance required, free metadata cannot override governance keys) and `retrieve` (scope required, native Qdrant filter, two-stage search, id logging, `RetrievalError`); 17 tests; three mutants killed |
| IMPL-RG-03 | [x] | callers: material pipeline (snapshot read once, shared with the learner block), chat prompt, introduction, quiz generation (summary written as `OWNER`), resource tasks, golden graph ingestion; citations by locator; degradation on `RetrievalError`; 25 new tests |
| IMPL-RG-04 | [x] | `config/governance_backfill.py` and `scripts/backfill_governance_metadata.py` (payload and `_node_content`, idempotent, dry run, indexes also created at startup); 7 tests |
| IMPL-RG-05 | [x] | images tagged `pre-rg-20261010`, `ai-api` and `celery-worker` rebuilt and recreated; backfill run live (65 updated, then 65 unchanged); production filter 0 to 65; scope isolation proven with temporary points; embedding gateway found out of credits (402) |
| IMPL-RG-06 | [x] | `AGENTS.md` "Retrieval" rules, tracker RC-17, memory |
