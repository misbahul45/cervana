# AI RAG Audit

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-04`
>
> Inventory and assessment of the AI service's retrieval-augmented generation (RAG) layer. Master prompt §24–§27 set the requirements. Source: `services/ai-api/` at HEAD `a868095`.

## 1. Pipeline (master prompt §24)

Existing pipeline:

```text
Resource (PDF / YouTube / text)
       ↓
Resource service (v1/resources/service.py)
       ↓
SmartChunker (config/embedding_pipeline.py:73-)
       ↓
QdrantVectorStore (reducera-embedding)
       ↓
Tutor service calls EmbeddingPipeline.retrieve(...)
       ↓
LLM context
```

The pipeline is implemented in code but the filtering discipline is incomplete.

## 2. Chunking

`SmartChunker` (lines 73-122) wraps `SemanticSplitterNodeParser.from_defaults(buffer_size=2, breakpoint_percentile_threshold=90, embed_model=embed_model)`. Fallback `SentenceSplitter(chunk_size=512, chunk_overlap=20)`. Defaults are reasonable. No domain-specific tuning.

## 3. Metadata (master prompt §25)

Document metadata stored:

```python
payload = {
    "userId": user_id,
    "memory_type": memory_type,
    "timestamp": datetime.utcnow().isoformat(),
    **(metadata or {}),
}
```

**Required (per master prompt)**: tenantId, resourceId, articleId, classId, topicId, subTopicId, lessonId, stepId, conceptIds, publicationStatus, visibility, entitlement, sourceType, version, contentHash.

**Actual**: `lessonId`, `topicId`, `userId`, `timestamp`. Anything else is application-supplied via `metadata`.

**Findings**:

- AI-RAG-01: `lessonId` and `topicId` are set, but `articleId`/`classId`/`conceptIds`/`publicationStatus`/`visibility`/`entitlement` are not. The application API's resource table has these fields but the AI does not consume them at insert or query time. Severity: HIGH.
- AI-RAG-02: `publicationStatus` and `visibility` are not enforced at retrieval. Any chunk in the store can be returned by the retriever. Master prompt §25: "Never retrieve everything then ask LLM to ignore forbidden content." The AI does retrieve everything matching the (often empty) `source` filter. Severity: HIGH.
- AI-RAG-03: at insert time, the AI service does not validate that the resource is published / has the right visibility. It accepts whatever the application API hands over. Severity: MEDIUM.

## 4. Retrieval filter (master prompt §25)

`EmbeddingPipeline.retrieve(query, metadata_filter=None, top_k=RETRIEVAL_K=20)` (`embedding_pipeline.py:228-252`) accepts a `metadata_filter` parameter but does not apply it. The `filters` variable is `None`; the retriever is built with `filters=None`. The `metadata_filter` parameter is **declared but unused**.

The caller in `v1/learning/service.py:94` passes `metadata_filter={"source": "material"}` — this is dropped. The actual retrieval has no metadata constraint.

**Findings**:

- AI-RAG-04: the `metadata_filter` parameter is dead code. Tenant isolation cannot be enforced at retrieval. Severity: CRITICAL.
- AI-RAG-05: top_k is hard-coded to 20 in `RETRIEVAL_K = 20`. The `top_k` parameter on `retrieve` is accepted but only the default is used. Severity: LOW.
- AI-RAG-06: there is no `transparency=translate` filter at retrieval; the `if self.enable_translation: query = self.translate(query)` branch translates the user query but the metadata is not. Severity: LOW.
- AI-RAG-07: RAG returns `{score, text, metadata}`. The `score` is a raw float; there is no reranking. The `text` is concatenated into the prompt without normalization. Severity: LOW.

## 5. Reranking

None. `EmbeddingPipeline.retrieve` returns the Qdrant top_k without a cross-encoder reranker, without LLM-based reranking, without diversity filtering. Master prompt §24: "Reranking → Evidence set". Severity: MEDIUM.

## 6. Citations (master prompt §26)

`content_pipeline.py:207` writes:

```python
state.generate = {
    "chatId": state.chatId,
    "chatMessageId": state.messageId,
    "data": content,
    "citatetions": [],  # TYPO: should be citations
    ...
}
```

The citation array is **hardcoded empty** and the field name is misspelled (`citatetions` not `citations`).

`tutor_endpoint.py` does not pass a `citations` field either. The LLM does not generate structured citations.

**Findings**:

- AI-RAG-08: hardcoded empty citations on every material generation. Master prompt §26: "Do not return citations: [] when the system actually depends on retrieved evidence." Severity: HIGH.
- AI-RAG-09: typo `citatetions` means even if a future fix populates this field, the application API would store it under the wrong column name. Severity: HIGH (consequential to AI-RAG-08).
- AI-RAG-10: no structured output schema. The LLM is free to invent citations. Severity: HIGH.
- AI-RAG-11: no mapping from Qdrant chunk id to readable source. Master prompt §26: "Each statement requiring source grounding should map to an evidence chunk." Severity: HIGH.

## 7. RAG security (master prompt §27, §92)

`config/prompt_segmentation.py:55-69` produces:

```xml
<retrieved_document id="..." source="..." trust="...">
  content
</retrieved_document>
```

It is called from `content_pipeline.py:152,156` (`segment_retrieved`) for RAG and web. **The user_input segment is NOT applied** — `build_segmented_prompt` accepts a `user_input` parameter but `generate_material` does not call it. **The LLM output is NOT wrapped** — the model writes into `state.generate.data` verbatim with no fence.

**Findings**:

- AI-RAG-12: user input to the tutor is not wrapped in `<user_input trust="untrusted">`. Severity: HIGH.
- AI-RAG-13: LLM output is not wrapped in `<llm_output trust="model">`. The application API has no way to distinguish system output from model output. Severity: MEDIUM.
- AI-RAG-14: `segment_retrieved` calls `looks_like_instruction` on each chunk before adding to the prompt. The RAG and web chunks are validated. Good.
- AI-RAG-15: `node_external_search` (`generate_user_steps_pipeline.py:130-138`) feeds Tavily output into the prompt directly without `looks_like_instruction` check. Master prompt §40, §92. Severity: HIGH.
- AI-RAG-16: `looks_like_instruction` test passes, but the regex is short (9 patterns). A well-crafted injection can bypass it. Severity: MEDIUM.

## 8. Web search policy (master prompt §40)

`utils/tools/web_search.py:11-37` is unrestricted:

- no domain allow-list
- no URL validation
- no size limit
- no content-type validation
- no injection isolation on the response

Per master prompt §40, web search is untrusted and requires these controls. The current implementation has none.

**Findings**:

- AI-RAG-17: web search has no domain allow-list. The LLM is told "how to learn {step.title} in {topic.title}" and any URL may be returned. Severity: HIGH.
- AI-RAG-18: web search response is concatenated as plain text into the prompt. There is no fence. Severity: HIGH (compounded with AI-RAG-15).
- AI-RAG-19: no timeout enforcement on the Tavily call other than `requests.post(..., timeout=10)`. 10 s is reasonable. Severity: NONE.

## 9. RAG in chat (tutor)

`v1/learning/service.py:88-154` (`get_propmpt_material`):

1. PATCH chat message to "Retrieved RAG materials for query: ..." (this string goes into the chat as user-visible text — minor, but a leak of internal terminology)
2. Call `pipeline.retrieve(query=query, metadata_filter={"source": "material"}, top_k=10)` — filter is dropped (AI-RAG-04)
3. PATCH chat message to "Performing web search..." (same)
4. `tool_web_search(query, limit=10)` — no domain allow-list (AI-RAG-17)
5. PATCH chat message to "Analysing user memory..." (same)
6. `memory_manager.retrieve_as_string(user_id, top_k=10, memory_type="query")` — `memory_type="query"` doesn't exist in upserts; should be `learning_path` (AI-MEM-03)
7. Construct a single concatenated prompt with RAG + web + memory, no fences
8. Return the prompt to the caller

**Findings**:

- AI-RAG-20: internal status strings ("Retrieved RAG materials for query: ...") are PATCHed onto the chat message as user-visible text. This pollutes the chat log. Severity: LOW.
- AI-RAG-21: `memory_type="query"` is a bug. Should be the memory's actual type. Severity: LOW (the retrieve returns nothing because nothing matches the filter, so the prompt has empty memory).
- AI-RAG-22: the prompt template (lines 126-152) is a single concatenated string with no trust fence. Master prompt §20 requires typed sections. Severity: HIGH.

## 10. Summary scorecard (AI-RAG)

| Area | Status |
|---|---|
| Pipeline (extract → chunk → embed → store) | `IMPLEMENTED` |
| Chunker | `IMPLEMENTED` (default 512/20 fallback) |
| Metadata (tenant, status, visibility) | `MISSING` (only lessonId/topicId) |
| Retrieval filter | `BROKEN` (parameter declared, never applied) |
| Reranking | `MISSING` |
| Citations | `BROKEN` (hardcoded empty + typo) |
| Prompt segmentation (RAG/web) | `PARTIAL` (RAG/web fenced; user input not) |
| Web search policy (allow-list) | `MISSING` |
| Output fence | `MISSING` (LLM output not wrapped) |
| Trust boundaries (system policy, learning context) | `PRESENT` in segmentation framework |
| User memory isolation (in chat) | `PRESENT` (userId filter) |

## 11. Required next-step

For Phase 2 (Accounting Domain Foundation) and Phase 4 (Memory), the AI needs to:

1. Fix the dead `metadata_filter` parameter in `EmbeddingPipeline.retrieve` so tenant, publicationStatus, visibility, and entitlement actually filter the Qdrant query.
2. Fix the `citatetions` typo and add structured citation output (chunk id → source title/URL mapping).
3. Add a domain allow-list to `tool_web_search` and a content-type / size cap.
4. Wrap user input and LLM output in `<user_input trust="untrusted">` and `<llm_output trust="model">` segments.
5. Apply `looks_like_instruction` to web search output and LLM output before persisting to memory or to the chat log.
6. Add a reranker (cross-encoder or LLM-based) before the prompt is built.

These are scoped to Phase 2 per master prompt §108, with web search and RAG security slated for Phase 5 (master prompt §40, §27).

## 12. Cross-references

- `ai-foundation-audit.md`
- `ai-domain-audit.md`
- `ai-memory-audit.md`
- `ai-agent-audit.md`
- `ai-evaluation-audit.md`
- `api-business-flow-traceability.md` BF-009 (RAG), BF-011 (cite grounded), BF-020 (web search)
- `api-business-logic-audit.md` F-09 (memory isolation)
