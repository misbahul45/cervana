# AI Memory Audit — services/ai-api

**Scope:** Phase 0 master-prompt §110. Map-and-list depth. `services/ai-api` only.
**Audit date:** 2026-10-05.
**Service container:** `reducera_ai_api` :3003. **Source of truth:** `services/api` :3002 (NestJS).
**Evidence rule:** every claim cites a file and line range, or `MISSING` is stated.

---

## 1. Headline Verdict

The service implements **one memory layer only — a flat semantic store in Qdrant** — surfaced by a `MemoryManager` class and three thin tool wrappers (`tool_semantic_search`, `tool_semantic_search_with_fallback`, `tool_memory_upsert`, `tool_memory_read`). The other three typed layers (working, episodic, procedural) **do not exist as code**; LangGraph state objects are used as transient scratchpads but are not modeled as memory. The write path enforces **only one policy** — instruction-injection rejection via `looks_like_instruction` — and is missing salience, confidence, evidence, novelty, recurrence, privacy, and retention gates. Retrieval scores by **vector similarity only**; there is no decay or recency weighting. User isolation is enforced by a hard `userId` filter at the Qdrant level but is **not exercised by a dedicated test**. The fallback variant `tool_semantic_search_with_fallback` is **defined and tested but never called** in any production path. The primary behavioral test file `test_memory.py` is **COLLECT-IGNORED** by `pyproject.toml:42-43`, so its assertions do not run in CI.

## 2. Typed Memory Layers

| Item | Status | Evidence |
|---|---|---|
| Semantic memory layer as code | PRESENT | `config/memory_embedding.py:40-130` (`MemoryManager` class) |
| Episodic memory layer as code | **MISSING** | grep across `services/ai-api` for `episodic\|episode_store` returns zero matches; only `mastery` string in `v1/agents/career_agent.py:18-34` is an HTTP call to api's `/v1/personalization/mastery/me` endpoint, not an episode record |
| Procedural memory layer as code | **MISSING** | grep for `procedural` returns zero matches in `services/ai-api` |
| Working memory (typed, per-request scratchpad) | **MISSING** | no `WorkingMemory` class or equivalent; LangGraph state objects `GenerateContentMaterialPipeline` (`v1/learning/dto.py:94-118`) and `LPState` (`v1/users_steps/dto.py:187-210`) are the only per-request scratchpads and are not typed as memory |
| Single `MemoryManager` instance per process | PRESENT | `utils/tools/memory.py:9-10` (module-level singleton from `get_embedding_pipeline().embed_model`) |

## 3. Semantic Memory (`config/memory_embedding.py`)

| Item | Status | Evidence |
|---|---|---|
| `MemoryManager` class with `upsert` + `retrieve` | PRESENT | `config/memory_embedding.py:40-130` |
| `upsert` persists `userId` per item | PRESENT | `config/memory_embedding.py:66-71` (`payload["userId"] = user_id`) |
| `upsert` persists `memory_type` per item | PRESENT | `config/memory_embedding.py:66-71` (`payload["memory_type"] = memory_type`) |
| `upsert` persists `timestamp` per item | PRESENT | `config/memory_embedding.py:66-71` (`datetime.utcnow().isoformat()`) |
| `upsert` persists caller-supplied `lessonId` metadata | PRESENT | `utils/tools/memory.py:94-97` |
| `confidence` per item | **MISSING** | not in `payload` dict at `config/memory_embedding.py:66-71`; no `confidence` key anywhere on the write path |
| `evidenceCount` per item | **MISSING** | not in `payload` dict; not in metadata |
| `provenance` per item (source citation, model version, prompt hash) | **MISSING** | not in `payload` dict; no per-item `source_id`, `prompt_version`, `embedding_model` recorded |
| `retrieve` filters by `userId` (hard invariant) | PRESENT | `config/memory_embedding.py:89-91` (`MetadataFilter(key="userId", value=user_id, operator=FilterOperator.EQ)`) |
| `retrieve` filters by `memory_type` when supplied | PRESENT | `config/memory_embedding.py:93-96` |
| `retrieve` returns `{score, text, metadata}` shape | PRESENT | `config/memory_embedding.py:111-117` |
| Embedding model reused from `EmbeddingPipeline` | PRESENT | `utils/tools/memory.py:9-10` |
| Read-side error handling | PRESENT but **INERT** | `config/memory_embedding.py:105-109` — `except Exception` returns `[]`; cannot distinguish "no memory" from "Qdrant down" |
| `retrieve_as_string` helper | PRESENT | `config/memory_embedding.py:121-130` (never called in code) |

## 4. Episodic Memory

| Item | Status | Evidence |
|---|---|---|
| Episode schema with `learner`, `task`, `domain context`, `learner state snapshot`, `policy decision`, `memory used`, `evidence used`, `tutor response`, `tool usage`, `outcome`, `evaluator result`, `prompt version`, `policy version`, `token usage`, `cost`, `latency` (master prompt §42) | **MISSING** | no `Episode` table, no DDL, no module, no Pydantic model — grep `episodic\|Episode` in `services/ai-api` returns zero code matches; only `mastery` HTTP call in `v1/agents/career_agent.py:18-34` (different concept) |
| Episode write on tutor run | **MISSING** | `v1/learning/content_pipeline.py:264-271` returns final state; no episode creation |
| Episode write on learning-path generation | **MISSING** | `v1/users_steps/generate_user_steps_pipeline.py:255-369` has no episode hook |
| Per-run token / cost / latency capture | **MISSING** | no telemetry hook records `inputTokens`, `outputTokens`, `costUsd`, `latencyMs` per episode (cross-reference: foundation audit §9) |
| Decision trace written by ai-api on learning paths | **MISSING** | `v1/users_steps/generate_user_steps_pipeline.py`, `v1/learning/content_pipeline.py` — no decision-trace POST anywhere |

## 5. Working Memory

| Item | Status | Evidence |
|---|---|---|
| Per-request scratchpad via LangGraph state | PRESENT but **INERT as memory** | `GenerateContentMaterialPipeline` (`v1/learning/dto.py:94-118`) and `LPState` (`v1/users_steps/dto.py:187-210`) carry per-request fields but are not modeled as a memory layer |
| Working memory fields: `intent`, `scratchpad`, `current_step`, `open_questions`, `pending_tools` | **MISSING** | no such fields in either state class |
| Cross-node working-memory handoff (carry scratchpad across nodes) | PARTIAL | LangGraph state is passed by value across nodes; but there is no explicit "working memory" reducer or compaction step |
| Working memory reset between sessions | IMPLICIT | LangGraph state lifetime is one `graph.invoke()` call; nothing persists to Qdrant or Redis between calls |

## 6. Procedural Memory

| Item | Status | Evidence |
|---|---|---|
| Stable learner-specific procedures (master prompt §110) | **MISSING** | no `procedural_memory` module; no per-learner procedure store |
| Reusable procedure candidates harvested from sessions | **MISSING** | no extraction step in any pipeline |
| Procedure selection at tutor time | **MISSING** | no consult on procedure store before generating content |

## 7. Memory Write Policy (`MemoryService.should_store(event)`)

| Item | Status | Evidence |
|---|---|---|
| `MemoryService` class with `should_store` gate | **MISSING** | no `MemoryService` symbol in `services/ai-api`; grep `MemoryService\|should_store` returns zero matches |
| Salience gate on write | **MISSING** | not implemented; `MemoryManager.upsert` (`config/memory_embedding.py:58-81`) writes whatever text the caller passes |
| Evidence gate on write | **MISSING** | not implemented |
| Confidence gate on write | **MISSING** | not implemented |
| Novelty gate on write (skip near-duplicates) | **MISSING** | no similarity check before upsert |
| Recurrence gate on write (skip one-off observations) | **MISSING** | no counter or frequency check |
| Privacy gate on write (PII redaction / token strip) | **MISSING** | no redaction; `state.token` from Celery payload (foundation audit §11 critical defect) can flow into the prompt that is then upserted via `tool_memory_upsert` (`v1/learning/content_pipeline.py:84, 243`) |
| Retention policy (TTL, decay, deletion) | **MISSING** | no `delete` operation exists in `MemoryManager`; no TTL field on items |

## 8. Instruction-Injection Defense on Write (master prompt §91, §33)

| Item | Status | Evidence |
|---|---|---|
| `tool_memory_upsert` calls `looks_like_instruction` before writing | PRESENT | `utils/tools/memory.py:86-89` |
| `looks_like_instruction` regex set covers common injection patterns | PRESENT | `config/prompt_segmentation.py:19-32` (8 regex patterns: ignore/disregard/forget instructions, system prompt, you-are-now, reveal prompt, assistant must, developer instructions, override policy) |
| Rejection is logged at WARNING with user + lesson | PRESENT | `utils/tools/memory.py:88` |
| Behavioral test for instruction rejection | PRESENT but **INERT** | `utils/tools/__tests__/test_memory.py:163-172` (asserts `upsert` not called and warning logged), but this test file is **COLLECT-IGNORED** by `pyproject.toml:42-43` |

## 9. Memory Decay / Recency-Aware Scoring (master prompt §34)

| Item | Status | Evidence |
|---|---|---|
| Retrieval multiplies `relevance × confidence × scope match × recency × salience` | **MISSING** | `MemoryManager.retrieve` returns raw `score` from Qdrant similarity (`config/memory_embedding.py:113-117`); no time decay, no confidence, no scope multiplier, no salience |
| `timestamp` recorded on every item | PRESENT | `config/memory_embedding.py:69`, `utils/tools/memory.py:96` |
| Recency-weighted sort in read paths | PARTIAL | `tool_memory_read` sorts by `timestamp` descending (`utils/tools/memory.py:121-127`); `tool_semantic_search` and `tool_semantic_search_with_fallback` do NOT sort — they return items in Qdrant similarity order |
| TTL field on items | **MISSING** | no TTL recorded; no purge job |
| Decay function (linear, exponential, half-life) | **MISSING** | not implemented |
| Confidence multiplier | **MISSING** | not implemented (no confidence field at all, see §3) |

## 10. Memory Isolation

| Item | Status | Evidence |
|---|---|---|
| Hard invariant: Learner A never retrieves Learner B | PRESENT in code, **UNVERIFIED by test** | `MetadataFilter(key="userId", value=user_id, operator=FilterOperator.EQ)` in `config/memory_embedding.py:90`; same pattern in `_semantic_search` call site (`utils/tools/memory.py:48-52`); filter is the only gate, so cross-user leakage is structurally impossible at the Qdrant query level |
| `userId` is required on every read path | PRESENT | `MemoryManager.retrieve` signature requires `user_id` (`config/memory_embedding.py:84-87`); `_semantic_search` requires `userId` (`utils/tools/memory.py:40-46`); `tool_memory_read` requires `userId` (`utils/tools/memory.py:103`) |
| Dedicated user-isolation test (Learner A vs Learner B) | **MISSING** | no test that asserts a retrieve call with `user_id="A"` never returns items whose metadata `userId` is `B`; `test_memory.py:26-87` only exercises lesson-scope filtering using a single mock `MemoryManager`, never exercises the real Qdrant filter |
| `userId` is derived from authenticated context (never from request body) | PARTIAL | `tool_memory_upsert(userId, lessonId, text)` and friends take `userId` as argument; in `v1/learning/content_pipeline.py:84, 243` and `v1/users_steps/generate_user_steps_pipeline.py:355` the value comes from `state.userId`; in `v1/users_steps/generate_user_steps_pipeline.py:104, 118` from `state.userId`. Identity source is the LangGraph state, not request body. No trust-boundary check that `state.userId` actually matches the JWT — `state.token` is forwarded raw in Celery payload (foundation audit §11 critical defect) |
| `lessonId` does not leak across users via shared collection | PRESENT | Qdrant filter combines `userId == X AND memory_type == Y`; lesson filter is applied client-side after Qdrant returns user-scoped hits (`utils/tools/memory.py:54-58, 115-118`); if Qdrant ever drops the `userId` filter, the client-side lesson filter would still apply per-user, but cross-user leakage is impossible without a `userId` filter bypass |

## 11. Lesson-Scope Fallback Policy

| Item | Status | Evidence |
|---|---|---|
| Strict variant `tool_semantic_search(allow_fallback=False)` | PRESENT | `utils/tools/memory.py:13-20` (delegates to `_semantic_search(allow_fallback=False)`) |
| Fallback variant `tool_semantic_search_with_fallback(allow_fallback=True)` | PRESENT | `utils/tools/memory.py:23-37` (delegates to `_semantic_search(allow_fallback=True, fallback_limit=N)`) |
| Strict variant USED in production paths | PRESENT | `v1/learning/content_pipeline.py:86`, `v1/users_steps/generate_user_steps_pipeline.py:118` |
| Fallback variant USED in production paths | **MISSING** | grep across `services/ai-api` for `tool_semantic_search_with_fallback` returns only the definition at `utils/tools/memory.py:23` and its test references; **no production caller** |
| Fallback path logs WARNING | PRESENT | `utils/tools/memory.py:64-67` |
| Fallback warning asserted in test | PRESENT but **INERT** | `test_memory_lesson_scope.py:64-72` runs in CI (test file is not collect-ignored); `test_memory.py:139-159` is COLLECT-IGNORED |
| Strict path returns `[]` on no-match | PRESENT | `utils/tools/memory.py:70-74`; asserted in `test_memory.py:41-66`, `test_memory_lesson_scope.py:37-48` |
| Cross-lesson leakage through the fallback | OBSERVABLE | `utils/tools/memory.py:67-68` (`return items[:fallback_limit]`) returns items whose `lessonId` does not match the requested lessonId — by design but explicitly logged; callers do not see the WARNING message and have no way to opt out per call beyond not calling this function |

## 12. Required Memory Tests (master prompt §97)

| Test | Status | Evidence |
|---|---|---|
| Store meaningful event | PRESENT but **INERT** | `test_memory.py:174-180` (asserts `upsert` called once) — file is COLLECT-IGNORED by `pyproject.toml:42-43` |
| Reject low-salience | **MISSING** | no salience model in code (see §7) |
| Reject instruction-like | PRESENT but **INERT** | `test_memory.py:163-172` — file is COLLECT-IGNORED |
| Confidence threshold | **MISSING** | no confidence model in code |
| Evidence threshold | **MISSING** | no evidence model in code |
| Memory decay | **MISSING** | no decay in code (see §9) |
| Retrieval ranking | PRESENT but **INERT** | `test_memory.py:26-87` covers lesson-scope filtering and fallback ranking — file is COLLECT-IGNORED; `test_memory_lesson_scope.py:21-72` runs in CI and duplicates the lesson-scope portion |
| User isolation (Learner A never sees Learner B) | **MISSING dedicated test** | only the Qdrant filter exists in code; no test exercises it end-to-end |
| Lesson isolation | PRESENT | `test_memory.py:26-87` (COLLECT-IGNORED) + `test_memory_lesson_scope.py:21-48` (active in CI) |
| Update conflict | **MISSING** | no `update` operation in `MemoryManager`; only `upsert` which appends a new vector point per call (no overwrite key, no conflict detection) |
| Delete | **MISSING** | no `delete` operation in `MemoryManager` (`config/memory_embedding.py` only has `upsert`, `retrieve`, `retrieve_as_string`); no `purge_by_user` or `purge_by_lesson` method |
| Retention | **MISSING** | no TTL, no purge job, no retention configuration (see §9) |

## 13. Memory Collection in Qdrant

| Item | Status | Evidence |
|---|---|---|
| `QDRANT_MEMORY_COLLECTION` env var | PRESENT | `config/envs.py:14` (typed in `ENVConfig`) and `config/envs.py:57` (default `"reducera-memory"`) |
| `MemoryManager` initializes from `QDRANT_MEMORY_COLLECTION` only | PRESENT | `config/memory_embedding.py:24, 28, 30-33` (uses `MEMORY_COLLECTION = ENVS["QDRANT_MEMORY_COLLECTION"]` for both `ensure_collection` and `QdrantVectorStore`) |
| Vector size mismatch at startup aborts boot | PRESENT | `config/vector_collections.py:13-19` (raises `RuntimeError` if `vectors.size != EMBEDDING_DIM`); called from `config/memory_embedding.py:28` |
| Memory collection is separate from the RAG content collection | PRESENT | `config/envs.py:13-14, 40, 57` (`QDRANT_COLLECTION="reducera-embedding"` vs `QDRANT_MEMORY_COLLECTION="reducera-memory"`); `EmbeddingPipeline` uses the former (`config/embedding_pipeline.py:32`), `MemoryManager` uses the latter (`config/memory_embedding.py:24`) |
| Collection lifecycle is process-singleton | PRESENT | `config/memory_embedding.py:22-37` runs at module import; restarts pick up existing collection |

## 14. Memory Call Sites in Tutor and Learning-Path Pipelines

| Item | Status | Evidence |
|---|---|---|
| Tutor run reads memory before generating | PRESENT | `v1/learning/content_pipeline.py:86` (`tool_semantic_search` strict variant, `top_k=15`) |
| Tutor run writes memory after analysis | PRESENT | `v1/learning/content_pipeline.py:84` (writes LLM analysis text unconditionally) |
| Tutor run writes memory after content generation | PRESENT but **INERT as gate** | `v1/learning/content_pipeline.py:241-249` writes the full LLM-generated `content`; no length cap, no LLM-failure detection (the fallback error string at `v1/learning/content_pipeline.py:222-225` would be upserted if LLM call failed) |
| Learning-path run reads memory | PRESENT | `v1/users_steps/generate_user_steps_pipeline.py:104` (`tool_memory_read`, `limit=10`) and `:118` (`tool_semantic_search` strict) |
| Learning-path run writes memory | PRESENT | `v1/users_steps/generate_user_steps_pipeline.py:355` (writes the LLM-generated step titles summary) |
| `tool_memory_read` (raw history) used anywhere | PRESENT | `v1/users_steps/generate_user_steps_pipeline.py:104` only |
| `tool_semantic_search_with_fallback` used anywhere | **MISSING** | orphan code (see §11) |
| `memory_manager` (the singleton) imported in router/service | PRESENT | `v1/learning/service.py:8` (imported but not used in any other line of that file) |

## 15. Critical Defects (memory layer)

| Severity | Defect | Location |
|---|---|---|
| CRITICAL | `utils/tools/__tests__/test_memory.py` is COLLECT-IGNORED by pytest, so every behavioral assertion it contains (instruction rejection, lesson isolation, fallback cap, fallback warning) does not run in CI | `pyproject.toml:42-43`; assertions at `test_memory.py:26-87, 139-188` |
| HIGH | No salience, evidence, confidence, novelty, recurrence, privacy, or retention gate on memory write — anything the LLM emits, including error fallbacks, is upserted | `config/memory_embedding.py:58-81`; `utils/tools/memory.py:81-101`; `v1/learning/content_pipeline.py:84, 241-249` |
| HIGH | No decay / recency scoring in retrieval — old memories score the same as new; `tool_semantic_search` does not even sort by timestamp | `config/memory_embedding.py:83-119`; `utils/tools/memory.py:40-78` |
| HIGH | No confidence, evidence, or provenance field persisted on each memory item — cannot filter unreliable memories | `config/memory_embedding.py:66-71` |
| HIGH | No dedicated user-isolation test (Learner A vs Learner B) — the only `userId` filter lives inside Qdrant and is never exercised by an integration test | §10; no test file present |
| HIGH | No `delete` or `update` operation in `MemoryManager` — once written, memory is permanent in the collection; GDPR / right-to-erasure cannot be honored from ai-api | `config/memory_embedding.py:40-130` |
| HIGH | LLM error fallback strings are upserted to memory unconditionally | `v1/learning/content_pipeline.py:80-84, 222-249` (write happens before LLM call exit path is checked; the same call's `except` block returns an error message that is then upserted at `:243`) |
| MEDIUM | `tool_semantic_search_with_fallback` is defined and tested but never called in production — orphan code; cross-lesson fallback behavior is silently unreachable | `utils/tools/memory.py:23-37`; §11 |
| MEDIUM | Bearer token forwarded into Celery payload can flow into the LLM prompt that is then upserted to memory via `tool_memory_upsert` (foundation audit §11 cross-link) | `v1/learning/router.py:19-22` → `v1/learning/workers.py:23, 53` → `v1/learning/content_pipeline.py:84, 243` |
| MEDIUM | `memory_manager` imported in `v1/learning/service.py:8` but never used — dead import | `v1/learning/service.py:8` |
| MEDIUM | `retrieve_as_string` helper defined in `MemoryManager` but never called anywhere in `services/ai-api` | `config/memory_embedding.py:121-130` |
| LOW | `tool_memory_read` is only called from the learning-path pipeline, not from the tutor pipeline — tutor pipeline relies solely on `tool_semantic_search` and never sees the raw history | `v1/learning/content_pipeline.py:86` (only `tool_semantic_search` call) vs `v1/users_steps/generate_user_steps_pipeline.py:104, 118` (both) |
| LOW | Read-side error handling returns `[]` silently on every failure mode, conflating "no memory" with "Qdrant unavailable" / "filter misconfigured" | `config/memory_embedding.py:105-109`; `utils/tools/memory.py:76-78, 99-100, 130-132` |

## 16. Evidence Trail Summary

| Cluster | Files | What's confirmed |
|---|---|---|
| Semantic memory write/read | `config/memory_embedding.py:40-130`, `utils/tools/memory.py:1-133` | `MemoryManager` class; `userId` + `memory_type` + `timestamp` fields; lesson-scope strict + fallback wrappers; Qdrant `QDRANT_MEMORY_COLLECTION` |
| Instruction-injection defense | `config/prompt_segmentation.py:19-39`, `utils/tools/memory.py:81-101`, `utils/tools/__tests__/test_memory.py:163-188` (COLLECT-IGNORED) | `looks_like_instruction` regex set, called in `tool_memory_upsert`, logged at WARNING |
| Lesson-scope fallback policy | `utils/tools/memory.py:13-78`, `utils/tools/__tests__/test_memory_lesson_scope.py:21-72`, `utils/tools/__tests__/test_memory.py:90-159` (COLLECT-IGNORED) | strict + fallback wrappers; fallback warning at WARNING; CI-running tests cover the strict path and fallback cap; orphan fallback caller in production |
| Tutor memory use | `v1/learning/content_pipeline.py:84, 86, 241-249` | reads strict before generation; writes analysis text and full content after each step |
| Learning-path memory use | `v1/users_steps/generate_user_steps_pipeline.py:101-128, 355` | reads both `tool_memory_read` and `tool_semantic_search` (strict); writes step-titles summary after generation |
| Qdrant collection lifecycle | `config/vector_collections.py:5-20`, `config/memory_embedding.py:22-37`, `config/envs.py:13-14, 40, 57` | `ensure_collection` for both RAG and memory; size-mismatch raises `RuntimeError`; process-singleton initialization |
| Episodic / Procedural / Working memory | (no files) | grep for `episodic`, `procedural`, `workingMemory`, `episode_store` returns zero matches in `services/ai-api`; the only `mastery` match in `v1/agents/career_agent.py:18-34` is an HTTP call to the api for a different concept |
| Test surface | `pyproject.toml:39-43`, `utils/tools/__tests__/test_memory.py`, `utils/tools/__tests__/test_memory_lesson_scope.py` | `testpaths` includes `utils/tools/__tests__`; `test_memory.py` is COLLECT-IGNORED; `test_memory_lesson_scope.py` runs in CI |

## 17. What Phase 4 Must Build

```text
1.  Remove `utils/tools/__tests__/test_memory.py` from `pyproject.toml:42-43` `collect_ignore`
    so its assertions (instruction rejection, lesson isolation, fallback cap, fallback warning)
    run in CI. Investigate why it was ignored (likely Qdrant fixture missing) and add a fixture.

2.  Add a dedicated `test_memory_user_isolation.py` that runs against a real or test Qdrant
    instance: insert items for user A and user B, assert `retrieve(user_id="A", ...)` returns
    zero items whose metadata `userId` is `B`. No such test currently exists.

3.  Add typed fields to each memory item beyond `{userId, memory_type, timestamp}`:
    `confidence` (0-1), `evidenceCount` (int), `provenance` (source id + prompt version
    + embedding model + retrieval version), `salience` (0-1), `ttlAt` (ISO timestamp or null).
    Backfill migration: re-embed existing items with default values or quarantine.

4.  Build a `MemoryService.should_store(event)` policy module that gates every upsert
    through salience threshold, evidence threshold, confidence threshold, novelty check
    (similarity to existing items < threshold), recurrence check (count within window),
    privacy check (PII / token / bearer redaction), and retention (TTL enforcement).

5.  Replace the unconditional `tool_memory_upsert` calls in `v1/learning/content_pipeline.py:84, 243`
    and `v1/users_steps/generate_user_steps_pipeline.py:355` with the gated path. Never upsert
    when the LLM call returned the error fallback (`v1/learning/content_pipeline.py:80, 222-225`).

6.  Add decay / recency-aware scoring to retrieval. Multiply `similarity × confidence ×
    scope_match × recency_weight(timestamp) × salience`. Sort `tool_semantic_search` results
    by the composite score, not raw Qdrant similarity. Add half-life configurable per
    `memory_type`.

7.  Add a `delete` operation to `MemoryManager`: `delete_by_user(userId)`, `delete_by_lesson(userId, lessonId)`,
    and `delete_by_id(point_id)`. Honor GDPR right-to-erasure from ai-api. The Qdrant
    client already supports `client.delete(...)`.

8.  Either wire `tool_semantic_search_with_fallback` into a real caller that benefits from
    cross-lesson context (e.g. personality insights), or delete it. Orphan code is dangerous:
    tests assert behavior that production never exercises.

9.  Add an `Episode` write path on every tutor run, every learning-path generation, and
    every quiz generation. POST to `services/api` over HTTP with the full §42 schema:
    `learner, task, domain context, learner state snapshot, policy decision, memory used,
    evidence used, tutor response, tool usage, outcome, evaluator result, prompt version,
    policy version, token usage, cost, latency`. Capture `inputTokens`, `outputTokens`,
    `costUsd`, `latencyMs` from every LLM call (currently zero telemetry hook exists —
    cross-reference foundation audit §9).

10. Add a `WorkingMemory` reducer for LangGraph state: explicit fields `intent`, `scratchpad`,
    `current_step`, `open_questions`, `pending_tools`. Compaction step that summarizes
    `scratchpad` after each node if it exceeds a token budget.

11. Add a `ProceduralMemory` module: extract reusable procedure candidates from completed
    episodes (one procedure per N successful runs of a similar task), store as
    `(procedureId, steps, applicabilityCondition, successRate)`, and consult at tutor
    time before generating content.

12. Cross-link with the foundation audit critical defect: bearer token is forwarded into
    the Celery payload. Until that is fixed, any prompt that goes through
    `tool_memory_upsert` can carry `state.token` into long-term storage. Add a privacy
    gate that strips tokens, PII (email, phone, name patterns), and any field matching
    `Authorization|Bearer` before write.
```
