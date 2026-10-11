# Memory Audit — Layers, Write Policy, Scoping

> **Status**: `stable` · **Owner**: `ml-lead` · **Last reviewed**: `2026-10-09`
>
> Three separate memory stores exist; this file states which one runs, what it stores, and what protects it.

---

## Scope

Production memory in Qdrant (`reducera-memory`), the api's memory tables and routes, and the typed memory package in ai-api (`v1/memory`). Checked against the required record fields (user, tenant, scope, source, confidence, evidence count, created, expires, status, version), write policy, decay and scoped retrieval.

## Findings

### Three stores

| Store | Location | Record fields | Written by a production path | Read by a production path | Status |
|---|---|---|---|---|---|
| A. Vector memory | Qdrant `reducera-memory` via `MemoryManager` (`services/ai-api/config/memory_embedding.py:58-100`) | `userId`, `memory_type`, `timestamp`, `lessonId` + text. No tenant, scope, source, confidence, evidence count, expiry, status or version | `content_pipeline.py:177,404` and `users_steps/generate_user_steps_pipeline.py:376`: all call `tool_memory_upsert` with wrong keyword names (C-003) | `learning/service.py:307-315` (chat), `content_pipeline.py:186` (C-003) | `BROKEN`; live collection has 0 points |
| B. Relational memory | `EpisodicMemory` (`services/api/prisma/schema.prisma:1179`), routes `GET/POST /personalization/memory`, `POST …/distill` (`services/api/src/v1/personalization/memory/memory.controller.ts:7-44`) | user, event type, content, source, lesson/step/topic, `importance`, `evidenceCount`, `lastUsedAt`, `expiresAt`, `status`; no tenant, no version | the curriculum agent writes `SHORT_TERM` rows (`v1/agents/curriculum_agent.py`); `SHORT_TERM` gets a TTL, long-term kinds do not (`memory.service.ts:23-27`) | reads exclude expired rows (`memory.repo.ts:33-39`) | `PARTIAL` |
| C. Typed layers | `services/ai-api/v1/memory/` (working, episodic, semantic, procedural; write policy; decay; isolation; 9 modules, 963 lines) | in-process objects only; no I/O in the package or in `learner_model`, `tutor`, `domain` | none | none | `UNWIRED` |
| Semantic and procedural tables | `SemanticLearnerMemory` (`schema.prisma:1200`), `ProceduralMemory` (`:1214`) | confidence, evidence count, status; no tenant, no version | none | none | `SCAFFOLDED` |

### Requirement check

| Requirement | Store A | Store B | Store C |
|---|---|---|---|
| Postgres is source of truth, Qdrant is index | no: Qdrant holds the only copy | table exists, not mirrored to Qdrant | n/a |
| Scoped by user | yes, in the store query (`memory_embedding.py:88-96`; filter keys are unprefixed, matching the flattened payload) | yes (`userId`) | `isolation.py` present (66 lines; contents not read) |
| Scoped by tenant | no | no | n/a |
| Scoped by content entitlement / domain | no | no | not read |
| Lesson scope | applied after retrieval: `top_k` items for the user are fetched, then filtered by `lessonId` in Python (`utils/tools/memory.py:51-58`), so relevant lesson items beyond `top_k` are dropped | `lessonId` column | n/a |
| Write policy rejects instructions | partly: `looks_like_instruction` check (`utils/tools/memory.py:85-93`) | no check | `MemoryWritePolicy.is_instruction_like` |
| Do not store every chat or raw model output | no (M-007) | client-supplied payload | `MemoryWritePolicy` exists (`types.py`); only `is_instruction_like` was traced |
| Expiry, importance, decay, supersede, archive | no | `expiresAt` for short-term only; `importance` unused by retrieval | `decay.py` provides `rank_candidates` (traced); supersede and archive not read |
| Evidence-based traits | no | `evidenceCount` stored, no promotion rule | `semantic.py` provides `recall`; its promotion rule was not read |

### C-003

**Memory tool calls raise `TypeError`.** `utils/tools/memory.py` declares `tool_semantic_search(userId, lessonId, top_k)`, `tool_memory_upsert(userId, lessonId, text)` and siblings (`:13,23,85,107`). Five production call sites pass `user_id=` and `lesson_id=`:

| Call site | Wrapped by |
|---|---|
| `services/ai-api/v1/learning/content_pipeline.py:177` | `except MemoryError` |
| `services/ai-api/v1/learning/content_pipeline.py:186` | `except RetrievalError` |
| `services/ai-api/v1/learning/content_pipeline.py:404` | `except MemoryError` |
| `services/ai-api/v1/users_steps/generate_user_steps_pipeline.py:142` | `except RetrievalError` |
| `services/ai-api/v1/users_steps/generate_user_steps_pipeline.py:376` | `except MemoryError`, inside an outer `except Exception` that logs |

`MemoryError` and `RetrievalError` derive from `AIServiceError` (`services/ai-api/errors/types.py:19-26`), not from `TypeError`, so the first four sites propagate the error and end the pipeline; the fifth is swallowed and logged. The passing tests replace the functions with `patch.object` mocks (`v1/learning/__tests__/test_content_pipeline_routing.py:44-45`, `v1/users_steps/__tests__/test_pipelines_routing.py:83,92`), which accept any keywords, so the mismatch is invisible to the suite. Memory integration in these pipelines is `UNVERIFIED` by tests and `BROKEN` by call-signature analysis (AST comparison of definitions and calls, re-run on the committed tree). The live `reducera-memory` collection has 0 points, which is consistent with no write ever succeeding.

### M-007

**Model output is stored as memory unconditionally.** After generation, the full lesson text is upserted (`content_pipeline.py:402-410`) and so is the learner-analysis text, including the literal fallback `"Analysis unavailable for …"` (`:167-183`). The only filter is an instruction-pattern check. This stores generated prose as if it were a learner fact, without source, confidence or expiry, which is the memory-poisoning path the specification excludes.

### M-013

**Client-supplied long-term memory.** `POST /personalization/memory` accepts `{ lessonId?, kind: 'SHORT_TERM' | 'LONG_TERM_PROFILE' | 'LONG_TERM_MISCONCEPTION', payload: unknown }` with an inline type and no Zod schema (`memory.controller.ts:30-44`), against the rule that write DTOs use Zod `.strict()` (`AGENTS.md`, "DTO integrity"). A learner can write their own `LONG_TERM_PROFILE` and `LONG_TERM_MISCONCEPTION` records, which are unverified traits, and the route has no instruction filter. The impact is limited to the caller's own memory because identity comes from the session.

## Evidence citations

- `services/ai-api/config/memory_embedding.py:58-100`; `services/ai-api/utils/tools/memory.py:13-136`
- `services/ai-api/v1/learning/content_pipeline.py:167-186,402-410`; `services/ai-api/errors/types.py:14-31`
- `services/ai-api/v1/memory/` (package files); tests `v1/memory/__tests__` (39)
- `services/api/prisma/schema.prisma:1179-1231`; `services/api/src/v1/personalization/memory/{memory.controller,memory.service,memory.repo}.ts`
- Qdrant: `GET /collections/reducera-memory` → 0 points (2026-10-09)

## Verdict

Memory is not a working learner-memory system. The store that production code targets cannot be written because of a keyword mismatch, holds no governance fields, and receives raw model output when it can. The relational store has the right shape for episodic memory and is used by one agent; its semantic and procedural siblings have no code. The typed memory layers, which implement write policy, decay and isolation, are unit-tested and unreachable.
