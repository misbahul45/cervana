# Business Logic Location Audit

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-09-30`
>
> Where business rules currently live in Cervana, and where they *should* live. Rules embedded in LLM prompts are classified as **architectural debt** unless migrated.

---

## 1. Purpose

A business rule that lives in an LLM prompt is:

- **Inconsistent** across runs (LLM non-determinism).
- **Untestable** with golden vectors.
- **Unreviewable** by humans (no static review of prompt strings).
- **Unenforceable** at runtime (LLM may ignore).

This audit enumerates every rule currently embedded in a prompt and prescribes its deterministic replacement.

---

## 2. Rules currently in prompts

### 2.1 Out-of-scope refusal — `v1/learning/service.py:127-153`

```python
prompt = f"""
You are an expert AI Learning Assistant. The user has a learning goal: "{user_step_title}".
...
**Out-of-Context Handling:**
If the user's question is outside the scope of the learning goal or unrelated to the current learning context, respond with:
"Maaf, saya belum bisa menjawab itu karena pertanyaannya di luar konteks pembelajaran saat ini."
...
"""
```

**Problem**: the LLM may ignore this instruction; we have no way to verify refusal.

**Correct location**: a deterministic scope check **before** the LLM call.

```python
def is_in_scope(query: str, course_context: str) -> bool:
    return embedding_similarity(query, course_context) > SCOPE_THRESHOLD

if not is_in_scope(query, course_context):
    return fixed_refusal_message(query)
```

Score: similarity threshold is testable; refusal is consistent.

### 2.2 Empty quiz fallback — `v1/users_steps/generate_quiz_pipeline.py:147-154`

```python
try:
    response = structured_llm.invoke(...)
    parsed = QuizResponse.model_validate(response)
except Exception:
    parsed = QuizResponse(quiz=[])
```

**Problem**: if the LLM fails to produce valid JSON, the user gets an empty quiz with no explanation.

**Correct location**: validate JSON schema before returning; if invalid, retry once with explicit correction; if still invalid, return 422 with diagnostic.

### 2.3 Citation emptiness — `v1/learning/content_pipeline.py:212`, `v1/learning/workers.py:75`

```python
state.generate = {
    ...
    "citatetions": [],
    ...
}
```

**Problem**: `citatetions: []` is sent to the API. Users see no source attribution. LLM may have hallucinated citations that we strip silently.

**Correct location**: if retrieval returned zero chunks, the LLM call must **not** be made; the response must say "no relevant material found in the curriculum". If retrieval returned N chunks, all N must be cited. Citations must be machine-readable IDs, not LLM-generated strings.

### 2.4 Length constraints — `v1/learning/content_pipeline.py:179`

```
- Panjang: 300–700 kata
```

**Problem**: prompt-instructed length is not enforced.

**Correct location**: post-generation token-count check (`len(response.split()) > 300 and < 700`). If out of range, re-prompt with explicit length; if still out, trim or refuse.

### 2.5 Memory write policy — `v1/learning/content_pipeline.py:75`, `v1/learning/workers.py:81-86`

```python
if state.userId and state.lessonId:
    try:
        tool_memory_upsert(
            userId=state.userId,
            lessonId=state.lessonId,
            text=content
        )
    except Exception:
        pass
```

**Problem**: every LLM output is written to memory regardless of educational value. The `try/except: pass` masks even validation failures.

**Correct location**: an explicit `should_store(content, event_type, learner_state)` policy in `MemoryService` per [`target-state.md`](../02-architecture/target-state.md) §4.3.

### 2.6 Cross-lesson memory fallback — `utils/tools/memory.py:25-33`

```python
if filtered:
    return filtered
return items[:5]   # ← cross-lesson leak
```

**Problem**: silent fallback to cross-lesson memory violates the lesson-scope contract.

**Correct location**: the caller decides the fallback policy, not the tool. Either:
- `tool_semantic_search_strict(userId, lessonId, top_k)` — returns `[]` if nothing matches.
- `tool_semantic_search_with_fallback(userId, lessonId, top_k, allow_fallback=True)` — caller opts in.

### 2.7 Material-bound scope — `v1/users_steps/generate_quiz_pipeline.py:60-141`

The LLM is told "Material-Bound" but only by prompt. If retrieved chunks include out-of-scope material (e.g., a math chunk in an accounting lesson), the LLM may produce off-topic questions.

**Correct location**: retrieved chunks must be filtered by `topic_id` before injection. The `metadata_filter` parameter on `EmbeddingPipeline.retrieve` exists but is never populated ([`embedding_pipeline.py:238-243`](../../ai-api-cervana/config/embedding_pipeline.py)).

### 2.8 Language constraints — multiple prompts

Multiple prompts include "use Indonesian" or "use Indonesian, professional". Language is a UX contract.

**Correct location**: language is a parameter on `chat_model` invocation, not a prompt instruction. Set `ChatOpenAI` (or equivalent) at deployment time.

### 2.9 Output schema — `v1/users_steps/generate_user_steps_pipeline.py:344-352`

The LLM is told "Output MUST be JSON ONLY. No markdown. No explanation." with strict validation.

**Problem**: this is enforced by `json.loads` after stripping ``` fences, which can fail on subtle JSON variants.

**Correct location**: every LLM call that returns structured data must use `with_structured_output(...)` (Pydantic model or JSON schema). Already done in [`generate_quiz_pipeline.py:147`](../../ai-api-cervana/v1/users_steps/generate_quiz_pipeline.py). Not done in [`generate_user_steps_pipeline.py:341`](../../ai-api-cervana/v1/users_steps/generate_user_steps_pipeline.py), [`content_pipeline.py:71`](../../ai-api-cervana/v1/learning/content_pipeline.py), or [`service.py:148`](../../ai-api-cervana/v1/learning/service.py).

---

## 3. Rules that are correctly in code

These are good — verify they stay so:

| Rule | Location |
|---|---|
| Streak `incrementOrReset` math | [`streaks.repo.ts:136-171`](../../cervana-api/src/v1/gamify/streaks/streaks.repo.ts) |
| `LeaderboardScore.increment` | [`leaderboards.repo.ts:151-174`](../../cervana-api/src/v1/gamify/leaderboards/leaderboards.repo.ts) |
| Zod validation on DTOs | all `*.dto.ts` files |
| `RolesGuard` enforcement | [`auth/guards/roles.guard.ts`](../../cervana-api/src/v1/auth/guards/roles.guard.ts) |
| Arcjet rate limit | [`main.ts`](../../cervana-api/src/main.ts) and per-route |
| `sameSite: 'none'` cookie config | [`auth.controller.ts:415-428`](../../cervana-api/src/v1/auth/auth.controller.ts) |
| `PersonalityQuizzesService.submitAttempt` level calculation | [`personality-quizzes.service.ts:140-156`](../../cervana-api/src/v1/learning/personality-quizzes/personality-quizzes.service.ts) (rule-based, not LLM) |

---

## 4. Risk classification

| Rule location | Severity | Risk |
|---|---|---|
| Out-of-scope refusal in prompt | HIGH | LLM may answer out-of-scope; learner trust damaged |
| Empty quiz fallback | MEDIUM | UX failure but not security |
| Citation emptiness | CRITICAL | False-grounding; learner may believe unsupported content |
| Length constraints | LOW | UX polish |
| Memory write policy | HIGH | Memory quality degrades → personalization wrong |
| Cross-lesson fallback | HIGH | Wrong context retrieved → wrong teaching |
| Material-bound scope | HIGH | Off-topic questions pollute competency model |
| Language constraints | LOW | UX |
| Output schema | MEDIUM | Pipeline break |

---

## 5. Migration plan

For each rule in §2, the migration follows:

1. Add a deterministic function or validation step **before** the LLM call (where possible).
2. Add post-generation validation **after** the LLM call (where pre-validation is impossible).
3. Add unit tests with golden vectors.
4. Keep the LLM as the **generator**, not the **judge**.

Order of migration:

| Step | Effort | Phase |
|---|---|---|
| 1. Citation: enforce chunks-before-LLM, all-N-must-be-cited | 1 day | Phase 0 |
| 2. Cross-lesson: strict-filter API | 0.5 day | Phase 2 |
| 3. Memory write policy in `MemoryService` | 2 days | Phase 2 |
| 4. Material-bound scope: `metadata_filter` on retrieve | 0.5 day | Phase 5 |
| 5. Out-of-scope refusal: deterministic scope check | 1 day | Phase 5 |
| 6. Output schema: `with_structured_output` everywhere | 1 day | Phase 5 |
| 7. Length constraints: token-count validation | 0.5 day | Phase 6 |
| 8. Language: model-level config | 0.5 day | Phase 1 (OpenAI migration) |

---

## 6. Cross-reference

This audit is the inventory companion to [`microservice-boundary-audit.md`](./microservice-boundary-audit.md) §6. Together they cover the master's "business logic in prompts" warning.