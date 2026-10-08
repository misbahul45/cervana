# AI Personalization Audit — services/ai-api

**Scope:** Phase 0 master-prompt §109 — Learner Model. Map-and-list depth.
**Audit date:** 2026-10-05.
**Service container:** `reducera_ai_api` :3003. **Source of truth for personalization:** `services/api` :3002 (NestJS).
**Evidence rule:** every claim cites a file and line range, or `MISSING` is stated.
**Honest verdict:** the AI service has **no personalization infrastructure of its own**. It only reads the static `LearningStyleProfile` (VAK/VARK + dominant style) owned by `services/api`, ingests a lesson-scoped memory store, injects both into prompts, and forwards the user's JWT to the api's `/v1/personalization/*` routes from two agent shims. It does not compute, persist, or update any learner model state.

---

## 1. Headline Verdict

The AI service is **not a learner-model owner**. Every concept the master prompt §109 lists (LearningEvent, Mastery/Elo, Confidence, Misconception, BehavioralSignals, LearnerGoal, LearnerState snapshot, AdaptivePolicyService, golden vectors, deterministic personalization invariants) is **MISSING** from `services/ai-api`. The two places where personalization-related *strings* appear are (a) `v1/agents/curriculum_agent.py` and `v1/agents/career_agent.py`, which HTTP-call the api's `/v1/personalization/*` endpoints and surface whatever the api returns; and (b) the prompt segmentation layout in `config/prompt_segmentation.py` which has empty `<learner_state>` and `<adaptive_strategy>` blocks but the caller in `v1/learning/content_pipeline.py:205-213` fills them with the raw `dominantStyle` string and a Markdown format hint, not with any computed state. The Phase 0 §109 deliverables all live in `services/api`; the corresponding audit there will document the `MasteryService`, `AdaptivePolicyService`, `MisconceptionService`, `LearnerSnapshot` and friends. **ai-api has nothing parallel.**

---

## 2. Learning Events (master prompt §109.1)

| Item | Status | Evidence |
|---|---|---|
| `LearningEvent` typed record (conceptId, kind, payload, source) | **MISSING** | no DTO, no schema, no module — `find` over `services/ai-api` for `LearningEvent` returns zero application matches |
| Pipeline emits a `LearningEvent` after generation/grading | **MISSING** | `v1/learning/content_pipeline.py:264-271` returns final state to Celery worker; `v1/learning/workers.py:20-39` only posts `create_content_material` and exits. No `learning_event/record` POST. |
| `v1/users_steps/generate_quiz_pipeline.py` emits events on quiz generation | **MISSING** | `v1/users_steps/workers.py:12-42` posts only `create_personality_quiz` to the api; no `LearningEvent` write |
| `v1/users_steps/generate_user_steps_pipeline.py` emits events on path generation | **MISSING** | `v1/users_steps/router.py:92-131` returns `state.generated.data`; no event emission |
| Memory upsert is the only learner-derived write | PRESENT (proxy) | `v1/learning/content_pipeline.py:84, 243-248` calls `tool_memory_upsert(userId, lessonId, text)`; `utils/tools/memory.py:81-100` writes a `learning_path`-typed Qdrant doc with `{userId, lessonId, timestamp}` metadata. This is *not* a `LearningEvent`; it is an opaque LLM output dump. |

---

## 3. Mastery / Elo-like Update (master prompt §109.2)

| Item | Status | Evidence |
|---|---|---|
| Mastery score compute, persist, expose (numeric Elo-like) | **MISSING** | no `MasteryService`, no `mastery_score`, no `k_factor` in `services/ai-api` |
| Golden vectors of `(learner state, interaction, expected new mastery)` | **MISSING** | no golden vector fixtures; `find` over `services/ai-api` for `golden_vector` returns zero matches |
| Hint-effect on mastery (Δ on hint use) | **MISSING** | no hint tracking; no `hint_count` field; `LearningStyleProfileBase.dominantStyle` is the only learner-derived signal used (`v1/users_steps/dto.py:72-87`) |
| Misconception-effect on mastery (Δ on detected misconception) | **MISSING** | no misconception detection; see §4 below |
| Confidence prediction per concept | **MISSING** | no `ConfidenceScore`, no Bayesian update, no Beta-Binomial model |
| External `mastery/me` read by an agent shim | PRESENT (read-only, delegated) | `v1/agents/career_agent.py:18` GETs `{NEST_API}/v1/personalization/mastery/me` and stores the JSON in `toolCalls` for the decision trace; **does not** compute, update, or persist any mastery locally. The match in `v1/agents/career_agent.py:25` (`m.get("score", 0) >= 0.85`) is a *post-hoc filter* on data already produced by the api. |

---

## 4. Confidence Model (master prompt §109.3)

| Item | Status | Evidence |
|---|---|---|
| Calibrated confidence per concept (`ConfidenceScore` with Brier / ECE) | **MISSING** | no `ConfidenceScore` symbol; no calibration; no Brier; no `predict_proba` |
| Confidence derived from attempt history (correct/incorrect streaks) | **MISSING** | no attempt history read; no streak compute |
| Confidence used to gate policy decisions | **MISSING** | no policy decisions in ai-api to gate (see §8) |
| Confidence surfaced back to the tutor prompt | **MISSING** | `v1/learning/content_pipeline.py:186-216` `<learner_state>` block contains only `Learning Style: {learning_style_str}` (line 205-207). No numeric confidence. |

---

## 5. Misconception Detection (master prompt §109.4)

| Item | Status | Evidence |
|---|---|---|
| Misconception proposed from learner answer | **MISSING** | no `MisconceptionService`; `find` over `services/ai-api` for `misconception` returns zero application matches (only the string "Misconception" absent everywhere except this audit) |
| Misconception confirmed by tutor or follow-up | **MISSING** | no follow-up flow exists in ai-api |
| Misconception persisted (active/resolved lifecycle) | **MISSING** | no write to `Misconception` table; the only persistence path is opaque LLM output to `tool_memory_upsert` |
| Misconception surfaced in prompt to bias scaffolding | **MISSING** | `v1/learning/content_pipeline.py:186-216` prompt has no misconception slot |

---

## 6. Behavioral Signals (master prompt §109.5)

| Item | Status | Evidence |
|---|---|---|
| `BehavioralSignals` record (hint dependency, error pattern, difficulty tolerance, response latency) | **MISSING** | no DTO, no module, no per-interaction measurement |
| Per-interaction latency captured | **MISSING** | no instrumentation; `v1/learning/workers.py` has no `time.time()` wrap; `v1/learning/content_pipeline.py` has no latency capture |
| Hint count captured | **MISSING** | no hint endpoint, no `hint_count` field; `v1/learning/content_pipeline.py` and `v1/users_steps/generate_quiz_pipeline.py` never call a hint function |
| Error pattern captured | **MISSING** | bare `except:` in `v1/learning/content_pipeline.py:37-39, 44-45, 92-94, 136-149` and `v1/learning/router.py:34-36, 58-60` swallow errors silently; they are not aggregated as behavioral signals |
| Difficulty tolerance signal | **MISSING** | no `tolerance` metric; the only "difficulty" string in ai-api is the LLM-generated `QuizItem.difficulty` literal in `v1/users_steps/dto.py:130` |

---

## 7. Goals (master prompt §109.6)

| Item | Status | Evidence |
|---|---|---|
| `LearnerGoal` model used by ai-api | **MISSING** | no `LearnerGoal` DTO, no module, no `goal_id` field anywhere in `services/ai-api` |
| Goal decomposition (sub-goals, micro-wins) | **MISSING** | no service. The closest thing is `v1/users_steps/generate_user_steps_pipeline.py:255-370` `node_generate` which asks the LLM to produce a sequence of micro-steps, but that is a one-shot `BaseUserStep` list (`v1/users_steps/dto.py:140-148`), not a typed `LearnerGoal` decomposition. The sequence is posted to the api without any explicit goal object. |
| Goal progress reported back to learner | **MISSING** | no endpoint or worker posts progress on a goal; `tool_memory_upsert` is the only learner-side write |

---

## 8. Learner State Snapshots (master prompt §109.7)

| Item | Status | Evidence |
|---|---|---|
| `LearnerState` snapshot persisted per interaction | **MISSING** | no `LearnerState` symbol; no `learner-state` POST; `v1/learning/content_pipeline.py` and `v1/learning/workers.py` never write such a record |
| Snapshot versioned (`learner_state_version` field) | **MISSING** | no version field anywhere in `services/ai-api`; the prompt segmentation template has a `<learner_state>` block (`config/prompt_segmentation.py:114-116`) but it is filled at call time with raw `dominantStyle` only — see `v1/learning/content_pipeline.py:205-207` |
| Snapshot read by another request | **MISSING** | no read path |
| Memory upsert acts as a stand-in | PRESENT (proxy, not a snapshot) | `utils/tools/memory.py:81-100` writes a `Document` with `{userId, lessonId, timestamp}` metadata to the Qdrant `reducera-memory` collection. This is an opaque text dump, not a typed `LearnerState` snapshot. |

---

## 9. Adaptive Policy (master prompt §109.8)

| Item | Status | Evidence |
|---|---|---|
| `AdaptivePolicyService` selecting mode/strategy/difficulty/hint/scaffolding | **MISSING** | no `AdaptivePolicyService` symbol; no module; no code path that selects a `mode` or `difficulty` from a learner-derived signal. The `EmbeddingPipeline.enable_thinking` flag (`config/embedding_pipeline.py:107`) is a *global* model-mode switch toggled in `v1/learning/workers.py:62`, not an adaptive policy decision per learner. |
| `PolicyVersion` recorded with each decision | **MISSING** | no `PolicyVersion` field anywhere in `services/ai-api` |
| Reason codes recorded (why a strategy was chosen) | **MISSING** | no `reason_code`, no `rationaleKind` field in any ai-api DTO. The literal `rationaleKind` does appear once in `v1/agents/__tests__/test_curriculum_agent.py:42, 71` — but as a *fake* server response in a unit test, never produced by ai-api code. |
| Policy delegation to api | PRESENT (delegated) | `v1/agents/curriculum_agent.py:27-29` GETs `{base}/v1/personalization/policy/next` and surfaces the result to the caller. The actual decision lives in `services/api` (see `services/api/src/v1/personalization/policy/adaptive-policy.service.ts` — out of scope here). |

---

## 10. Personalization Levels — master prompt §46

| Level | Status | Evidence |
|---|---|---|
| **Contextual** (lesson / topic / step context) | **PRESENT** | `v1/learning/content_pipeline.py:19-47` fetches `lesson`, `step`, `topic`, `userStep`; `v1/users_steps/generate_user_steps_pipeline.py:25-54` fetches topic, learning style, all steps, target step, personality quiz. This is the strongest level present. |
| **History-aware** (prior answers, prior content views) | **PARTIAL** | `v1/learning/content_pipeline.py:86` reads `tool_semantic_search(userId, lessonId, top_k=15)` lesson-scoped memory; `v1/learning/content_pipeline.py:91-94` reads `query_content_history(chatId, ...)` chat-scoped history. Both are *content-side* history (RAG + chat), not attempt/answer history. No `LearningEvent` reads, no `MasteryScore` reads (except via the agent shims in `v1/agents/career_agent.py:18`). |
| **Skill-aware** (mastery, misconception) | **MISSING** | no mastery compute, no misconception detection in ai-api. The `career_agent` *reads* `/v1/personalization/mastery/me` (`v1/agents/career_agent.py:18`) but uses it only as a `strongTopics` filter for the decision trace. |
| **Preference-aware** (VAK/VARK dominant style) | **PRESENT** | `LearningStyleProfileBase` (`v1/users_steps/dto.py:72-87`) provides `visual/auditory/reading/kinesthetic/dominantStyle`. The dominant style is injected into the prompt in `v1/learning/content_pipeline.py:60-72, 164-167, 205-207` and into the learning-path prompt in `v1/users_steps/generate_user_steps_pipeline.py:67-72, 183`. `v1/users_steps/service.py:99-114` classifies the style with a keyword heuristic. |
| **Longitudinal** (cross-session growth, spaced review) | **MISSING** | no `LearnerState` snapshots, no spaced review, no cross-session growth metric. The `MemoryManager` (`config/memory_embedding.py:40-119`) stores text but no temporal/recency schema for spaced review. |

---

## 11. Deterministic Personalization Invariants

| Invariant | Status | Evidence |
|---|---|---|
| Same input + same policy version = same decision | **MISSING** (no policy) | no `PolicyVersion`; no decision is made in ai-api |
| Difficulty in [0,1] | **MISSING** (no difficulty) | the only `difficulty` is a categorical string `Literal["easy","medium","hard","hots"]` in `v1/users_steps/dto.py:130` produced by the LLM, not a numeric float |
| Scaffolding bump on open misconception | **MISSING** | no misconception; no scaffolding bump |
| Same input + same `enable_thinking` flag = same LLM output | **WEAKLY PARTIAL** | `v1/learning/workers.py:62` toggles `pipeline.enable_thinking = False` before calling `pipeline.llm.invoke(prompt)` (line 69). Because the LLM is non-deterministic by default (no `seed` set, no temperature override in `v1/learning/workers.py:68-75`), the same input is NOT guaranteed to produce the same output. The `temperature` is only set for the *flash* model in `config/providers.py:137-138`; thinking mode (`v1/learning/workers.py:69` uses `llm.invoke`, not the thinking model) is unset. |
| Memory upsert is idempotent per (userId, lessonId, text) | **PARTIAL** | `utils/tools/memory.py:81-100` always upserts a new Qdrant point for the same `(userId, text)` pair; no dedup by content hash. Multiple identical upserts accumulate. |

---

## 12. Tests for Personalization — master prompt §98

| Item | Status | Evidence |
|---|---|---|
| `>= 100` golden-vector property tests for personalization | **MISSING** | `find` for `golden_vector` in `services/ai-api` returns zero matches. The only test files in `services/ai-api` are: `__tests__/test_main_no_subprocess_spawn.py`, `tests/test_main.py`, `tests/test_web_search.py`, `config/__tests__/test_embedding_pipeline.py`, `config/__tests__/test_no_gemini.py`, `config/__tests__/test_prompt_segmentation.py`, `config/__tests__/test_providers.py`, `config/__tests__/test_rate_limit.py`, `config/__tests__/test_service_auth.py`, `config/__tests__/test_url_allowlist.py`, `config/__tests__/test_user_auth.py`, `config/__tests__/test_vector_collections.py`, `utils/tools/__tests__/test_memory.py` (`collect_ignore`d in `pyproject.toml:43-44`), `utils/tools/__tests__/test_memory_lesson_scope.py`, `v1/learning/__tests__/test_rag_recall.py`, `v1/learning/__tests__/test_service_prompt_fence.py`, `v1/learning/__tests__/test_tutor_citation.py`, `v1/agents/__tests__/test_curriculum_agent.py`, `v1/agents/__tests__/test_router_dispatch.py`, `v1/agents/__tests__/test_router_endpoint.py` — none test personalization invariants. |
| Test 1: same `(user, state) + same policy → same decision` | **MISSING** | no policy, no test |
| Test 2: hint-effect on mastery is monotone | **MISSING** | no hint tracking, no test |
| Test 3: misconception-effect lowers mastery and bumps scaffolding | **MISSING** | no misconception, no test |
| Test 4: difficulty stays in [0,1] | **MISSING** | no numeric difficulty, no test |
| Test 5: open misconception → scaffolding bump in next prompt | **MISSING** | no misconception, no test |
| Test 6: confidence is calibrated (Brier, ECE) | **MISSING** | no confidence, no test |
| Test 7: memory upsert is idempotent per content hash | **MISSING** | upsert is not idempotent; no test |
| Test 8: `LearnerState` snapshot version increments on change | **MISSING** | no snapshot, no version, no test |
| Test 9: `PolicyVersion` and reason codes recorded on every decision | **MISSING** | no policy, no decision, no test |

---

## 13. Critical Defects (personalization layer)

| Severity | Defect | Location |
|---|---|---|
| CRITICAL | No `LearningEvent` emission anywhere in the AI service. Mastery, misconception, behavioral signals cannot update because no event ever reaches a writer. | `v1/learning/workers.py:20-39`, `v1/learning/content_pipeline.py:264-271`, `v1/users_steps/workers.py:12-42`, `v1/users_steps/generate_user_steps_pipeline.py:255-370` |
| CRITICAL | No mastery compute or persist in ai-api. The `career_agent` shim reads `/v1/personalization/mastery/me` but never writes. | `v1/agents/career_agent.py:18-37` |
| CRITICAL | No adaptive policy in ai-api. `v1/agents/curriculum_agent.py:27-29` delegates the decision to the api; the call site has no fallback if the api is down. | `v1/agents/curriculum_agent.py:27-29` |
| HIGH | Memory upsert is not idempotent — repeated identical text accumulates unbounded Qdrant points under `reducera-memory` collection. | `utils/tools/memory.py:81-100` |
| HIGH | `<learner_state>` block in segmented prompt is filled with raw `dominantStyle` only; the slot name implies a richer typed state that does not exist. Misleading to operators reviewing prompt output. | `v1/learning/content_pipeline.py:205-207`, `config/prompt_segmentation.py:114-116` |
| MEDIUM | The LLM is invoked without a `seed`; same input + same `enable_thinking` flag does not guarantee same output. Breaks any future golden-vector test. | `v1/learning/workers.py:62-75`, `v1/learning/content_pipeline.py:218-225`, `config/providers.py:117-145` |
| MEDIUM | The test fixture in `v1/agents/__tests__/test_curriculum_agent.py:42, 71` invents a `rationaleKind` field that no ai-api code produces — the test passes against a mock, not a real decision. | `v1/agents/__tests__/test_curriculum_agent.py:42, 71` |
| LOW | The `curriculum_agent` and `career_agent` are the only places that mention personalization endpoints. They share no DTO with the rest of the service and bypass the LangGraph tutor pipeline entirely (`v1/learning/content_pipeline.py`). | `v1/agents/curriculum_agent.py`, `v1/agents/career_agent.py` |

---

## 14. Evidence Trail Summary

| Cluster (graph) | Files | What's confirmed |
|---|---|---|
| Tutor pipeline (no personalization) | `v1/learning/content_pipeline.py`, `v1/learning/workers.py`, `v1/learning/service.py`, `v1/learning/dto.py` | three-node LangGraph (parallel_fetch → prepare_learning_context → generate_material). Reads `LearningStyleProfileBase.dominantStyle` and `userStep`. No `LearningEvent`, no mastery, no misconception, no adaptive policy. |
| User-steps pipeline (no personalization) | `v1/users_steps/generate_user_steps_pipeline.py`, `v1/users_steps/generate_quiz_pipeline.py`, `v1/users_steps/workers.py`, `v1/users_steps/service.py`, `v1/users_steps/dto.py` | LPState includes `PersonalityQuizResult` (interpreted by LLM in `node_personality_material_builder`) and `LearningStyleProfileBase`; both are read into the prompt context, never written or updated. |
| Agents (delegation only) | `v1/agents/curriculum_agent.py`, `v1/agents/career_agent.py`, `v1/agents/creator_assistant_agent.py`, `v1/agents/router_endpoint.py`, `v1/agents/router.py` | `curriculum_agent` GETs `/v1/personalization/policy/next` and POSTs to `/v1/personalization/memory`; `career_agent` GETs `/v1/personalization/mastery/me`. All personalization state is owned by the api; ai-api is a read-through client. |
| Memory (proxy for learner state) | `utils/tools/memory.py`, `config/memory_embedding.py` | Qdrant `reducera-memory` collection holds opaque text dumps keyed by `{userId, memory_type, lessonId, timestamp}`. No typed fields for mastery, confidence, or misconception. |
| Prompt layout (slots exist, content thin) | `config/prompt_segmentation.py`, `v1/learning/content_pipeline.py:186-216` | `<learner_state>` and `<adaptive_strategy>` blocks present in the segmented prompt template; the learner_state block is filled with `Learning Style: {learning_style_str}` and the adaptive_strategy block with a Markdown format instruction. |
| Config (no personalization env) | `config/envs.py`, `config/embedding_pipeline.py`, `config/providers.py`, `config/memory_embedding.py`, `config/celery.py`, `config/prompt_segmentation.py`, `config/rate_limit.py`, `config/service_auth.py`, `config/user_auth.py`, `config/url_allowlist.py`, `config/vector_collections.py` | no env var, no DTO, no schema for `MasteryScore`, `ConfidenceScore`, `LearnerState`, `BehavioralSignals`, `LearnerGoal`, `PolicyVersion`, `HintLevel`, `ScaffoldLevel`, `MisconceptionTag`. The 11 config files contain 0 occurrences of any such symbol. |

---

## 15. What Phase 3 Must Build (personalization layer in services/ai-api)

```text
1.  New module services/ai-api/v1/personalization/events.py
    - emit_learning_event(event: LearningEventDto) → POST to api
      /v1/personalization/events (NEW endpoint on api side)
    - DTO: LearningEventDto{userId, conceptId, kind, payload, source,
      ts, idempotencyKey}
    - Wire emit calls in:
      * v1/learning/workers.py:38 (after create_content_material)
      * v1/users_steps/workers.py:38 (after create_personality_quiz)
      * v1/users_steps/router.py:98 (after generate_user_steps_pipeline.invoke)

2.  New module services/ai-api/v1/personalization/learner_state.py
    - read_learner_state(userId, lessonId) → GET /v1/personalization/state
    - snapshot_learner_state(userId, lessonId, version) → POST snapshot
    - Fill <learner_state> block in v1/learning/content_pipeline.py:205-207
      with the typed state, not the raw dominantStyle string

3.  New module services/ai-api/v1/personalization/policy.py
    - decide(userId, lessonId) → POST /v1/personalization/policy/decide
      (NEW endpoint on api side, deterministic, versioned)
    - record_policy_version(version, reasonCodes) → POST
      /v1/personalization/policy/versions
    - Replace the GET-then-store pattern in
      v1/agents/curriculum_agent.py:27-29 with the typed decide()

4.  New module services/ai-api/v1/personalization/mastery.py
    - read_mastery(userId, topicId[]) → GET /v1/personalization/mastery/me
    - apply_mastery_update(userId, topicId, delta) → POST
      /v1/personalization/mastery/update
    - idem: v1/agents/career_agent.py:18-25 should call read_mastery and
      then post a write-back, not a one-shot read

5.  New module services/ai-api/v1/personalization/confidence.py
    - compute_confidence(attempts: Attempt[]) -> ConfidenceScore
    - read_confidence(userId, conceptId) → GET
    - update_confidence(userId, conceptId, evidence) → POST
    - Required to fill master prompt §109.3 (calibrated confidence)

6.  New module services/ai-api/v1/personalization/misconception.py
    - detect_misconception(answer, expected, hintsUsed) -> MisconceptionTag[]
    - read_active_misconceptions(userId, lessonId) → GET
    - confirm_misconception(id) → POST
    - Bias prompt scaffolding in v1/learning/content_pipeline.py:186-216
      when active misconceptions exist

7.  New module services/ai-api/v1/personalization/behavioral.py
    - record_signal(userId, lessonId, signal: BehavioralSignal)
    - BehavioralSignal enum: HINT_USED, ERROR_REPEATED, DIFFICULTY_SKIP,
      RESPONSE_LATENCY_MS
    - Hook into v1/learning/workers.py:38 and v1/learning/content_pipeline.py
      node timings to capture latency

8.  New module services/ai-api/v1/personalization/goals.py
    - LearnerGoal DTO + read/write against /v1/personalization/goals (NEW)
    - Used by v1/users_steps/generate_user_steps_pipeline.py:255-370
      to scope micro-steps against an explicit goal

9.  New DTOs in services/ai-api/v1/personalization/dto.py
    LearningEventDto, LearnerStateSnapshot, PolicyDecision,
    PolicyVersion, ConfidenceScore, MasteryUpdate, MisconceptionTag,
    BehavioralSignal, LearnerGoal, HintEffectRecord, ScaffoldLevel
    All Pydantic BaseModel; Zod-equivalent validators on numeric ranges
    (difficulty in [0,1], mastery in [0,1], confidence in [0,1])

10. Test suite in services/ai-api/v1/personalization/__tests__/
    - test_golden_vector_determinism.py (>= 100 vectors)
    - test_policy_version_monotone.py
    - test_difficulty_in_unit_interval.py
    - test_misconception_bump_scaffolding.py
    - test_confidence_calibration.py
    - test_memory_idempotent_upsert.py
    - test_learner_state_version_increment.py
    - test_hint_effect_monotone.py
    - test_policy_version_recorded.py
    - test_signal_capture.py

11. Determinism: set ChatOpenAI(temperature=0) or seed= for every
    personalization-path call site, so golden-vector tests can be stable.
    Affects v1/learning/content_pipeline.py:218-225,
    v1/learning/workers.py:68-75, v1/users_steps/generate_user_steps_pipeline.py:340-352
    (raise_max_tokens needed to keep thinking models deterministic)

12. Make utils/tools/memory.py upsert idempotent by content_hash to
    support regression testing of personalization prompts.
```
