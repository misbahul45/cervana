# AI Memory Audit

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-04`
>
> Inventory and assessment of the AI service's memory layer. Master prompt §28–§35 set the requirements. Source: `services/ai-api/` at HEAD `a868095`. The application API's memory layer is audited in `api-business-flow-traceability.md` BF-010 and is the source of memory policy.

## 1. Required layers (master prompt §28)

| Layer | Status | Evidence |
|---|---|---|
| Working memory | `MISSING` (typed) | `state` objects in LangGraph are not typed as a memory record |
| Episodic memory | `IMPLEMENTED` (Qdrant store) but no policy | `config/memory_embedding.py:MemoryManager.upsert` writes to `reducera-memory` collection |
| Semantic learner memory | `PARTIAL` (same store, single type) | `memory_type="learning_path"` only; no separate semantic vs episodic store |
| Procedural memory | `MISSING` (no representation) | none |

The Qdrant collection is shared between episodic and any other layer; the `memory_type` field is the only discriminator. There is no separate `MemoryStatus` lifecycle, no confidence column, no evidenceCount, no salience.

## 2. Write policy (master prompt §33)

The AI has **no write policy**. `tool_memory_upsert` (`utils/tools/memory.py:81`) takes any text and writes it:

```python
def tool_memory_upsert(userId: str, lessonId: str, text: str):
    try:
        memory_manager.upsert(
            user_id=userId,
            text=text,
            memory_type="learning_path",
            metadata={
                "lessonId": lessonId,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
    except Exception as e:
        logger.error(...)
```

Required write policy (master prompt §33): validate (instruction-detection, salience, evidence, confidence, novelty, recurrence, privacy, retention). The current write has none. **Findings**:

- AI-MEM-01: every successful LLM generation is written to memory verbatim. `content_pipeline.py:220-226` writes `content` (the entire generated material) as a memory entry. The text is up to 700 words of LLM output that the same LLM will read back later. There is no instruction-injection filter applied at the AI side; `prompt_segmentation.looks_like_instruction` exists in source but is not called from the upsert path. Severity: HIGH.
- AI-MEM-02: no confidence or evidenceCount on the memory entry. The application API's `MemoryService` is the policy owner; the AI bypasses it. Severity: HIGH (master prompt §33: "AI can propose; the deterministic engine judges" — but here the AI does not propose, it persists directly).
- AI-MEM-03: memory type is always `"learning_path"`. No way to distinguish a short-term conversational summary from a long-term learner trait. Master prompt §28–§32 requires typed layers. Severity: HIGH.
- AI-MEM-04: TTL field exists in the Qdrant document metadata? No. The `timestamp` is recorded but no `decayAt` is set. Master prompt §34: decay applies to retrieval relevance, not historical truth — but here there is no decay at all. Severity: MEDIUM.
- AI-MEM-05: privacy filter (PII) is not applied. The LLM-generated text can include the user's name, location, and any detail the user typed into the conversation. Master prompt §91 (memory poisoning defense) applies. Severity: HIGH.

## 3. Retrieval policy (master prompt §34)

`tool_semantic_search` (`utils/tools/memory.py:13`) is strict by default:

```python
def tool_semantic_search(userId, lessonId, top_k=15):
    return _semantic_search(userId, lessonId, top_k, allow_fallback=False)
```

`_semantic_search` filters by `lessonId` after retrieving. If the filter finds nothing, it returns `[]`. There is a `tool_semantic_search_with_fallback` variant that can return up to `fallback_limit` unrelated items — this is logged at WARNING and is used only when callers explicitly opt in.

**Findings**:

- AI-MEM-06: `node_read_memory` in `generate_user_steps_pipeline.py:101-114` uses `tool_memory_read` (no lesson scope at all by default; it uses `state.lessonId` if passed). When the caller passes `lessonId=None`, it returns up to `limit=20` items regardless of lesson. Master prompt §35: memory must be lesson-scoped. Severity: MEDIUM.
- AI-MEM-07: retrieval score is the raw Qdrant similarity. There is no recency/usage/decay weighting (master prompt §34). Severity: LOW.
- AI-MEM-08: the `userId` filter is always present; `MemoryManager.retrieve` constructs `MetadataFilter(key="userId", value=user_id, operator=FilterOperator.EQ)`. Good. Severity: NONE.
- AI-MEM-09: cross-lesson leakage test exists (`utils/tools/__tests__/test_memory_lesson_scope.py`) but the source file's collection errors prevent the test from running in the current environment. Severity: MEDIUM.

## 4. Isolation (master prompt §35)

`MemoryManager` always filters by `userId` in Qdrant. Cross-user access requires a crafted `userId` value in the function call, which the AI service does not accept from the client (token-based). The AI gets `userId` from the authenticated user via the agent endpoint. Severity: NONE for the AI's own path.

## 5. Decay (master prompt §34)

None. There is no `decayAt` field, no scheduled decay job, no `retention` parameter. The Qdrant document carries `timestamp` only.

## 6. Memory poisoning defense (master prompt §91)

The `prompt_segmentation.looks_like_instruction` regex covers 9 patterns. The upsert path does not call it. The test in `config/__tests__/test_prompt_segmentation.py` is green; the production usage is missing.

**Findings**:

- AI-MEM-10: when the LLM generates text, the AI service does not call `looks_like_instruction` on the LLM output before writing it to memory. A memory-poisoning prompt could be stored and replayed. Severity: HIGH.
- AI-MEM-11: the test `test_memory_lesson_scope.py` exists in source but pytest collection fails. CI cannot enforce memory-isolation. Severity: MEDIUM.

## 7. RAG memory collision

`MemoryManager.upsert` calls `VectorStoreIndex.from_documents([doc], ...)` per call, which inserts a new vector each time. There is no `idempotencyKey`, so the same content creates duplicate memories. Master prompt §110: "useful memory survives, noise does not." Duplicate survival is the opposite. Severity: MEDIUM.

## 8. Summary scorecard (AI-MEM)

| Area | Status |
|---|---|
| Working memory (typed) | `MISSING` |
| Episodic memory | `PARTIAL` (Qdrant, single type field, no policy) |
| Semantic learner memory | `PARTIAL` (same store) |
| Procedural memory | `MISSING` |
| Write policy (validate, score) | `MISSING` (AI bypasses application API's `MemoryService`) |
| Confidence / evidenceCount | `MISSING` |
| Decay | `MISSING` |
| Privacy filter | `MISSING` |
| Instruction-injection filter at write | `MISSING` |
| Retrieval: recency/usage weighting | `MISSING` |
| User isolation | `PASS` (Qdrant filter) |
| Lesson isolation | `PASS` (default strict) |
| Cross-lesson leak fallback | `OPT-IN` only — log at WARNING |
| Idempotent upsert | `MISSING` (duplicate vectors) |

## 9. Required next-step

For Phase 4 (Memory), the AI needs to:

1. Call the application API's `MemoryService` (per `api-business-flow-traceability.md` BF-010) instead of writing Qdrant directly. The API is the policy owner.
2. Add `idempotencyKey` to upsert calls so the same event doesn't create duplicate memories.
3. Apply `looks_like_instruction` to LLM-generated text before persisting.
4. Add a `decayAt` field and a job to compute it.
5. Fix the test collection error for `test_memory_lesson_scope.py` so CI enforces isolation.

These are scoped to Phase 4 per master prompt §110.

## 10. Cross-references

- `ai-foundation-audit.md`
- `ai-domain-audit.md`
- `ai-personalization-audit.md`
- `ai-rag-audit.md`
- `ai-agent-audit.md`
- `api-business-flow-traceability.md` BF-010
- `api-business-logic-audit.md` F-09 (misconception), F-15 (memory isolation)
