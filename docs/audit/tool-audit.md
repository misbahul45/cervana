# Tool Audit

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-09-30`
>
> Every "tool" the AI service exposes to its LangGraph "agents", with permissions, side effects, failure modes, and classification.

---

## 1. Scope

Tools here are **Python functions** imported into LangGraph node bodies and called directly. The system does not use a formal tool-calling framework (`bind_tools`, `ToolNode`, etc.). This audit lists what tools exist, classifies them, and flags gaps.

A formal tool-calling framework is **not** required for the current architecture (linear LangGraph with imported functions). But it is required if the system ever transitions to a real agent loop (see [`microservice-boundary-audit.md`](./microservice-boundary-audit.md) §17 for "AI state ownership").

---

## 2. Tool inventory

| Tool | Module | Permission | Side effects | Failure mode | Notes |
|---|---|---|---|---|---|
| `EmbeddingPipeline.retrieve(query, metadata_filter, top_k)` | [`config/embedding_pipeline.py:231`](../../services/ai-api/config/embedding_pipeline.py) | R | none | Qdrant down → exception → caller swallows | `metadata_filter` exists but never populated |
| `MemoryManager.upsert(user_id, text, memory_type, metadata)` | [`config/memory_embedding.py:65`](../../services/ai-api/config/memory_embedding.py) | W | writes to Qdrant `reducera-memory` | Qdrant down → exception | No write policy |
| `MemoryManager.retrieve(user_id, top_k, memory_type)` | [`config/memory_embedding.py:90`](../../services/ai-api/config/memory_embedding.py) | R | none | Qdrant down → empty list | Includes user-filter at filter level |
| `MemoryManager.retrieve_as_string(...)` | [`config/memory_embedding.py:128`](../../services/ai-api/config/memory_embedding.py) | R | none | inherits | Returns concatenated text |
| `tool_semantic_search(userId, lessonId, top_k)` | [`utils/tools/memory.py:13`](../../services/ai-api/utils/tools/memory.py) | R | none | Qdrant down → empty list | ⚠ cross-lesson fallback bug |
| `tool_memory_upsert(userId, lessonId, text)` | [`utils/tools/memory.py:40`](../../services/ai-api/utils/tools/memory.py) | W | writes to Qdrant | Qdrant down → logged error, swallowed | No policy |
| `tool_memory_read(userId, lessonId, limit)` | [`utils/tools/memory.py:58`](../../services/ai-api/utils/tools/memory.py) | R | none | inherits | Sorted by timestamp |
| `tool_web_search(query, limit)` | [`utils/tools/web_search.py:11`](../../services/ai-api/utils/tools/web_search.py) | R + EXTERNAL HTTP | calls Tavily API | network failure → "" returned | No domain allow-list |
| `EmbeddingPipeline.llm.invoke(...)` (direct LLM call) | multiple files | COMPUTATION | external HTTP to the OpenAI-compatible LLM | network or rate-limit → exception | Not a "tool" but acts as one |
| `get_lesson(lessonId, token)` | [`v1/users_steps/service.py`](../../services/ai-api/v1/users_steps/service.py) | R | HTTP to NestJS | 4xx/5xx → `raise_for_status` | Forwarded bearer token |
| `get_step(stepId, token)` | same | R | HTTP to NestJS | same | – |
| `get_topic(topicId, token)` | same | R | HTTP to NestJS | same | – |
| `get_learning_style(learningStyleId, token)` | same | R | HTTP to NestJS | same | – |
| `get_personality_quiz(lessonId, userId, token)` | same | R | HTTP to NestJS | same | – |
| `get_steps(lessonId, token)` | same | R | HTTP to NestJS | same | – |
| `create_content_material(payload, token)` | [`v1/learning/service.py:78`](../../services/ai-api/v1/learning/service.py) | W | HTTP to NestJS | same | – |
| `create_message_chat(payload, token)` | [`v1/learning/service.py:23`](../../services/ai-api/v1/learning/service.py) | W | HTTP to NestJS | same | – |
| `update_message_chat(messageId, token, payload)` | [`v1/learning/service.py:13`](../../services/ai-api/v1/learning/service.py) | W | HTTP to NestJS | same | – |
| `query_content_history(chatId, q, token)` | [`v1/learning/service.py:32`](../../services/ai-api/v1/learning/service.py) | R | HTTP to NestJS | endpoint missing → `if except: return []` | ⚠ BROKEN |
| `create_personality_quiz(payload, token)` | [`v1/users_steps/service.py`](../../services/ai-api/v1/users_steps/service.py) | W | HTTP to NestJS | same | – |

---

## 3. Classification

Per the master prompt §29:

| Class | Count | Tools |
|---|---|---|
| READ | 9 | retrieve, MemoryManager.retrieve, tool_memory_read, tool_semantic_search, tool_web_search, get_lesson, get_step, get_topic, get_learning_style, get_personality_quiz, get_steps, query_content_history |
| WRITE | 5 | MemoryManager.upsert, tool_memory_upsert, create_content_material, create_message_chat, update_message_chat, create_personality_quiz |
| EXTERNAL ACTION | 0 | none |
| COMPUTATION | 1 | LLM call (direct) |
| RETRIEVAL | 1 | query_content_history (RAG over chat history) |

**Findings**:

- Zero EXTERNAL ACTION tools. The agents cannot, today, do anything that reaches outside the AI service boundary (DB or external systems). This is correct least-privilege.
- The Tavily tool (`tool_web_search`) is **unbounded** — any URL can be retrieved. There is no allow-list. A malicious tutor (or a compromised RAG corpus) could embed prompt-injection content into a web page; the AI service would retrieve it and feed it to the LLM.
- The chat-history retrieval (`query_content_history`) is **broken** — endpoint missing in NestJS. See [`microservice-boundary-audit.md` §17.1](./microservice-boundary-audit.md#1-microservice-boundaries-correct).

---

## 4. Permission / least-privilege

Tools have **no granular permission**. Any node in any LangGraph can call any tool. There is no per-node tool allow-list. The "agent" (which is a single LangGraph node in the current architecture) has full tool access.

If the system evolves to real agents with planning:

- Each agent must declare its allowed tool set.
- Tools must validate their caller (token-based or context-based).
- Forbidden tools must raise, not silently return empty.

Today, this is acceptable because there is no planning; tomorrow, it is required.

---

## 5. Idempotency

| Tool | Idempotent? | Notes |
|---|---|---|
| `MemoryManager.upsert` | yes (by content hash) but unverified | Qdrant deduplicates by vector ID; multiple calls with same content create multiple vectors |
| `tool_memory_upsert` | no (always inserts) | Every LLM output creates a new vector entry |
| `create_content_material` | no | POST creates a new `Content` row each time |
| `create_message_chat` | no | Same |
| `update_message_chat` | yes | PATCH is idempotent on same input |
| `query_content_history` | yes | GET is idempotent |

When a Celery task retries after partial failure, multiple calls to `tool_memory_upsert` and `create_content_material` will create duplicate memory entries and content rows. **No idempotency key** is currently used.

Fix: each POST to `api` should accept an `Idempotency-Key` header. The API stores `(userId, key, response)` in a small table and returns the same response for the same key within 24h.

---

## 6. Timeouts

| Tool | Timeout | Notes |
|---|---|---|
| `requests.post` (all REST calls) | 15s in code | – |
| `tool_web_search` (Tavily) | 10s | – |
| nginx → `ai-api` | 600s | SSE buffering off |
| Celery task | 600s (max runtime) | – |

Internal 15s + nginx 600s is fine. But there is no **per-tool timeout** that distinguishes "LLM call took 14s" from "REST call to NestJS failed in 1s". Without per-tool latency metrics, debugging slow paths is hard.

Fix: instrument each tool with OpenTelemetry span (Phase 11).

---

## 7. Side effects to monitor

Side-effecting tools:

- `MemoryManager.upsert`, `tool_memory_upsert` — write to Qdrant. Volume grows unboundedly without retention policy.
- `create_content_material` — writes to `contents` table.
- `create_message_chat` — writes to `chat_messages`.
- `update_message_chat` — mutates `chat_messages.status` / `text`.
- `create_personality_quiz` — writes to `personality_quizzes`.

Monitoring needed:

- Per-tool invocation count.
- Per-tool latency p50/p95.
- Per-tool error rate.
- Side-effect row count per tool per hour.

---

## 8. Cross-reference

- Architecture / RAG: [`system-audit.md`](./system-audit.md) §5
- Business logic in prompts vs tools: [`business-logic-location-audit.md`](./business-logic-location-audit.md)
- Permission / agent-state design: [`microservice-boundary-audit.md`](./microservice-boundary-audit.md) §4