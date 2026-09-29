# OpenAI Migration Plan

> **Status**: `planned` · **Owner**: `ml-lead` · **Last reviewed**: `2026-09-30`
>
> Replace `ChatGoogleGenerativeAI` + `GeminiEmbedding` with `langchain-openai` ChatOpenAI + OpenAIEmbeddings, fully env-driven.

---

## 1. Objective

Switch Cervana's AI service from Gemini to an OpenAI-compatible provider, with model name, API URL, embedding model, and embedding dimension all controlled by environment variables. This decouples the application from any single provider and enables swapping for cost, latency, or capability reasons.

---

## 2. Scope

Files affected:

- `ai-api-cervana/pyproject.toml`
- `ai-api-cervana/config/envs.py`
- `ai-api-cervana/config/embedding_pipeline.py`
- `ai-api-cervana/config/memory_embedding.py`
- `ai-api-cervana/v1/users_steps/generate_quiz_pipeline.py`
- `.env.example`, `.env.prod.example`
- `docker-compose.yml`, `docker-compose.prod.yml`

Total: **7 files**. No NestJS API change. No Nuxt web change.

---

## 3. Env contract

Add or update:

| Variable | Required | Default | Example | Purpose |
|---|---|---|---|---|
| `LLM_PROVIDER` | yes | `openai` | `openai` | Reserved for multi-provider |
| `OPENAI_API_KEY` | yes | – | `sk-...` | API key |
| `OPENAI_BASE_URL` | no | `https://api.openai.com/v1` | `https://api.together.xyz/v1` | Endpoint base URL |
| `LLM_MODEL` | yes | `gpt-4o-mini` | `gpt-4o`, `meta-llama/llama-3.1-70b-instruct` | Chat model |
| `LLM_TEMPERATURE` | no | `0.2` | `0.0` – `1.0` | Sampling temperature |
| `EMBEDDING_MODEL` | yes | `text-embedding-3-small` | `text-embedding-3-large` | Embedding model |
| `EMBEDDING_DIM` | yes | `768` | `1536`, `3072` | Embedding output dimension |
| `EMBEDDING_BASE_URL` | no | = `OPENAI_BASE_URL` | – | Override embedding endpoint |
| `LLM_REQUEST_TIMEOUT` | no | `60` | `30`, `120` | Seconds |

`OPENAI_API_KEY` already exists in `.env.example:69`. `EMBEDDING_MODEL` already exists. Others are new.

---

## 4. Target architecture

### 4.1 Pattern: factory in `ai-api-cervana/config/llm_factory.py`

```
ai-api-cervana/
├── config/
│   ├── llm_factory.py          ← NEW: factory for LLM + embeddings
│   ├── embedding_pipeline.py   ← CHANGED: use factory
│   ├── memory_embedding.py     ← CHANGED: use factory
│   ├── celery.py               ← unchanged
│   └── envs.py                 ← CHANGED: add fields
```

### 4.2 `llm_factory.py` contract

```python
from functools import lru_cache
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from config.envs import ENVS

@lru_cache(maxsize=1)
def get_chat_model() -> ChatOpenAI:
    return ChatOpenAI(
        model=ENVS["LLM_MODEL"],
        temperature=ENVS["LLM_TEMPERATURE"],
        api_key=ENVS["OPENAI_API_KEY"],
        base_url=ENVS["OPENAI_BASE_URL"],
        timeout=ENVS["LLM_REQUEST_TIMEOUT"],
        max_retries=2,
    )

@lru_cache(maxsize=1)
def get_embedding_model() -> OpenAIEmbeddings:
    kwargs = {
        "model": ENVS["EMBEDDING_MODEL"],
        "api_key": ENVS["OPENAI_API_KEY"],
        "dimensions": ENVS["EMBEDDING_DIM"],
    }
    if ENVS.get("EMBEDDING_BASE_URL"):
        kwargs["base_url"] = ENVS["EMBEDDING_BASE_URL"]
    return OpenAIEmbeddings(**kwargs)
```

---

## 5. Qdrant migration consideration

The current collection `cervana-embedding` is created with `size=768`:

```python
# ai-api-cervana/config/embedding_pipeline.py:60-63
qdrant_client.create_collection(
    collection_name=COLLECTION_NAME,
    vectors_config=VectorParams(size=768, distance=Distance.COSINE),
)
```

OpenAI's `text-embedding-3-small` defaults to 1536-dim but supports a `dimensions` parameter to return fewer dims. OpenAI's `text-embedding-3-large` also supports this.

**Two options**:

| Option | Trade-off |
|---|---|
| A: Keep 768-dim (`text-embedding-3-small` with `dimensions=768`) | Backward-compatible with existing Qdrant collection; data preserved. |
| B: Migrate to 1536-dim | More accurate embeddings; must recreate Qdrant collection and re-embed all resources; loses historical embeddings. |

**Recommendation**: start with **Option A**. Migrate to Option B in a later phase if accuracy warrants.

Validation behavior:
- If `EMBEDDING_DIM` matches the existing collection size: proceed.
- If `EMBEDDING_DIM` differs from the existing collection size: **fail-fast at startup** with a clear error. Do not auto-recreate.

---

## 6. Step-by-step implementation

### Step 1 — Dependencies (15 minutes)

- Add `langchain-openai>=0.2.0` to `ai-api-cervana/pyproject.toml`.
- Optionally remove `langchain-google-genai` and `llama-index-embeddings-gemini` (verify no other usage first).
- Add `tiktoken>=0.7` for token counting.

### Step 2 — Env (15 minutes)

- Update `config/envs.py` to include the new fields.
- Update `.env.example` and `.env.prod.example` with documentation for each.
- Update `docker-compose.yml` and `docker-compose.prod.yml` to pass new env vars to `ai-api` and `celery-worker`.

### Step 3 — Factory (20 minutes)

- Create `config/llm_factory.py` per §4.2.
- Add validation: raise at import if `OPENAI_API_KEY` is empty.

### Step 4 — Replace LLM init (30 minutes)

- In `config/embedding_pipeline.py:35-36`, replace hardcoded `EMBED_MODEL_NAME = "models/embedding-001"` and `CHAT_MODEL_NAME = "gemini-2.5-flash"` with reads from `ENVS`.
- Replace `embed_model = GeminiEmbedding(...)` and `llm_model = ChatGoogleGenerativeAI(...)` with `get_embedding_model()` and `get_chat_model()` from the factory.
- Replace Qdrant collection `VectorParams(size=768)` with `VectorParams(size=ENVS["EMBEDDING_DIM"])`.
- Add fail-fast check: query existing collection size; if mismatch with `EMBEDDING_DIM`, raise with clear message.

### Step 5 — Replace memory embedding init (15 minutes)

- Same as Step 4 for `config/memory_embedding.py`.

### Step 6 — Verify structured output (15 minutes)

- File `v1/users_steps/generate_quiz_pipeline.py:147`:
  ```python
  structured_llm = pipeline.llm.with_structured_output(QuizResponse)
  ```
- `ChatOpenAI` supports `method="function_calling"` (default) and `method="json_mode"`.
- For non-OpenAI providers, prefer `method="json_mode"` for compatibility.
- Add fallback: if `function_calling` fails, retry with `json_mode`.

### Step 7 — Smoke test (30 minutes)

```
export OPENAI_API_KEY=sk-...
export OPENAI_BASE_URL=https://api.openai.com/v1
export LLM_MODEL=gpt-4o-mini
export EMBEDDING_MODEL=text-embedding-3-small
export EMBEDDING_DIM=768

docker compose up -d --build ai-api celery-worker

# Trigger each flow and verify:
curl -X POST http://localhost/ai/v1/resources/extract?type=TEXT&resource_id=<id> ...
curl -X POST http://localhost/ai/v1/users-steps/generate ...
curl -X POST http://localhost/ai/v1/learning/generate-material ...

# Verify Qdrant:
curl http://localhost:6333/collections/cervana-embedding
# Expected: { "size": 768, "distance": "Cosine" }
```

### Step 8 — Optional: test alternate provider (30 minutes)

- Set `OPENAI_BASE_URL=https://api.together.xyz/v1` and `LLM_MODEL=meta-llama/llama-3.1-70b-instruct`.
- Re-run smoke test.

### Step 9 — Cleanup (15 minutes)

- Remove unused deps (`google-generativeai`, `langchain-google-genai`, `llama-index-embeddings-gemini`) if confirmed unused elsewhere.
- Update `Dockerfile` if any step references Gemini-specific commands.

---

## 7. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-OM-01 | `LLM_MODEL`, `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `EMBEDDING_MODEL`, `EMBEDDING_DIM` all read from env |
| AC-OM-02 | No references to `google-generativeai`, `ChatGoogleGenerativeAI`, `GeminiEmbedding` in code |
| AC-OM-03 | Smoke test passes for OpenAI |
| AC-OM-04 | Qdrant collection still size 768 (Option A) or migrated cleanly (Option B) |
| AC-OM-05 | `with_structured_output` works for `QuizResponse` |
| AC-OM-06 | Celery workers restart cleanly on env changes |
| AC-OM-07 | No breaking change in NestJS API or Nuxt Web |
| AC-OM-08 | `.env.example` documents all new variables |

---

## 8. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Prompt tuned for Gemini underperforms on GPT-4 | Medium | Iterate; tune `LLM_TEMPERATURE`; run eval set |
| OpenAI rate limit / downtime | Medium | Factory pattern allows provider swap without code change |
| `dimensions=768` not supported by some providers | Medium | Fail-fast at startup; document explicitly |
| `function_calling` not supported by non-OpenAI | Medium | Auto-fallback to `json_mode` |
| Koleksi Qdrant dimension mismatch | High | Fail-fast at startup; do not auto-recreate |
| Higher cost than Gemini Flash | Medium | Default to `gpt-4o-mini`; document trade-offs |

---

## 9. Rollback plan

1. Set `OPENAI_*` to empty / default.
2. Re-enable `GEMINI_API_KEY`.
3. Revert code change (single commit).
4. Restart services.

---

## 10. Trade-offs

| Choice | Alternative | Why this |
|---|---|---|
| OpenAI as primary | Keep Gemini | OpenAI provides stronger function-calling + structured output for `QuizResponse`. |
| `dimensions=768` (Option A) | Migrate to 1536 | Backward-compatible, no data loss. |
| `gpt-4o-mini` default | `gpt-4o` | `gpt-4o-mini` is 15× cheaper; quality sufficient for tutoring. Upgrade when eval demands. |
| Separate `EMBEDDING_BASE_URL` | Always use `OPENAI_BASE_URL` | Some providers (e.g., Cohere) have separate embedding endpoints. |

---

## 11. Open questions

| ID | Question | Decision owner |
|---|---|---|
| Q-07 | OpenAI vs Gemini vs both via `LLM_PROVIDER`? | product |
| Q-08 | Keep 768-dim (Option A) vs migrate to 1536 (Option B)? | architect |
| Q-12 | Default `LLM_MODEL`: `gpt-4o-mini` (cheap) vs `gpt-4o` (accurate)? | ml-lead |