# AI System Architecture

> **Status**: `planned` · **Owner**: `ai-architect` · **Last reviewed**: `2026-10-02`
>
> An AI plan that starts from the six existing `ai-api` routes and the unwired `api` services, and ends at a safe, measurable tutor with a decision authority matrix in which every row is a test target.

Facts: [`01-verification-delta.md`](./01-verification-delta.md) (VD). Decisions: D-08, D-09, D-10, D-13, D-21. Principles: AI recommends, deterministic services decide, humans approve sensitive actions; accounting truth comes from `AccountingSandboxService` only; no new microservice; `ai-api` never receives `DATABASE_URL`.

---

## 1. Inventory

### 1.1 `ai-api` routes, pipelines and tasks

All six routes are mounted under `/ai/v1` [VERIFIED: `main.py:54`, `v1/router.py:5-12`].

| Route or task | Status | Caller | Auth mode | Model mode | Writes | Evidence |
|---|---|---|---|---|---|---|
| `POST /resources/extract` | implemented | `api` BullMQ `knowledge` processor, which cannot reach it today (VD VF-16) | user token, validated by `GET /auth/profile`, roles `TEACHER` or `ADMIN`; rate limit 30 per minute | none | `api` callback `/internal/resources/callback` (HMAC) | `v1/resources/router.py:13-26`, `workers.py:36-80` |
| `POST /resources/embedding/{id}` | implemented | same | same | embeddings via Hugging Face | Qdrant `reducera-embedding`; `api` callback (HMAC) | `router.py:28-43`, `workers.py:83-129` |
| `POST /learning/generate-material` | implemented | browser, user JWT | header required, never validated; token in Celery args | thinking (`content_pipeline.py:202`), flash (`:75`) | `api` `POST /chat/contents` with the user token; Qdrant memory upsert | `v1/learning/router.py:12-37`, `workers.py:20-39` |
| `POST /learning/chat` | implemented | browser | same | flash | `api` chat messages and contents with the user token; citations stored as `[]` | `router.py:40-59`, `workers.py:42-92` |
| `GET /users-steps/generate-question` (SSE) | implemented | browser; `userId` and `token` in the query string | only `token` non-empty | flash | `api` personality quiz with the user token | `v1/users_steps/router.py:21-90` |
| `POST /users-steps/generate` | implemented | browser | check after `return`, never runs (VD VF-07) | flash (`generate_user_steps_pipeline.py:212`), thinking (`:341`) | none directly; returns generated steps | `router.py:92-130` |
| Celery tasks | `generate_content_material`, `generate_new_content`, `extract`, `embedding`, `generate_personality_quiz` | tasks | n/a | as above | as above | `v1/*/workers.py` |

Not present: agent runtime, tool registry, budgets, credit accounting, trace writer, scheduler [VERIFIED: grep, VD S-10].

### 1.2 `api`-side AI modules

| Module | Status | Provided by a module | Reachable | Defect |
|---|---|---|---|---|
| `TutorService`, `POST /tutor/message` | partial | `TutorModule` | yes, `@AuthenticatedOnly()` | template reply, no LLM, policy not persisted (VF-06) |
| `MasteryService` | scaffolded | `TutorModule` | no writer | saturating formula (VF-02) |
| `MisconceptionLifecycleService` | scaffolded | `TutorModule` | writer only in `recordAttemptOutcome`, no caller | none found |
| `AdaptivePolicyService`, `PersonalPolicyService` | scaffolded | `TutorModule` | via `respond` | policy empty each call |
| `QuestionUnderstandingService`, `QuestionBlueprintService` | partial | `TutorModule` | via `respond` | heuristic intent detection |
| `QuizEvaluationService` | scaffolded | none | spec only | not applied to attempts |
| `AiCreditsService` | scaffolded | none | spec only | VF-01 |
| `PerInteractionEvaluatorService`, `FrozenBenchmarkService` | scaffolded | none | spec only | heuristic scoring (VF-05) |
| `PromptOptimizationService` | scaffolded | none | spec only | none found |
| `MetricsService` | partial | `MetricsModule` | public route (VF-08) | n/a |

---

## 2. Decision authority matrix

Each row is a test target. Test IDs use `AU-nn`; the file path is where the test is created.

| ID | Decision | Proposes | Decides | Approves | Audit record | Test target |
|---|---|---|---|---|---|---|
| AU-01 | Journal entry correctness | Learner | `AccountingSandboxService` | none | `SandboxAttempt`, entry rows | `sandbox/__tests__/engine-authority.spec.ts`: a model response cannot change `validate` or `post` output |
| AU-02 | MCQ and numeric grading | none | `QuizEvaluationService` on the server | none | `QuizAttempt`, `Answer` | `quiz/__tests__/server-scoring.spec.ts`: client-sent `isCorrect` and `score` are ignored |
| AU-03 | Free-text grading | AI judge with rubric | Rubric threshold | Teacher override when the grade gates access or rewards | `InteractionEvaluation`, `TeacherOverride` | `evaluation/__tests__/free-text-gate.spec.ts`: a gating grade without override stays `PROVISIONAL` |
| AU-04 | Mastery update | none | `MasteryService` from learning events | none | `TopicMasteryRecord`, `LearningEvent` | `learner-model/__tests__/mastery-golden.spec.ts` (§3.2) |
| AU-05 | Next activity | AI rationale | Adaptive policy (difficulty inside the zone of proximal development) | none | `DecisionTrace` | `policy/__tests__/policy-authority.spec.ts`: rationale text cannot alter strategy or difficulty |
| AU-06 | Memory write | AI candidate | Memory write policy in `api` | none | memory tables | `memory/__tests__/write-policy.spec.ts` (§4) |
| AU-07 | Content or agent publication | Creator | Validators | Reviewer or `ADMIN` | `AuditLog` | `articles/__tests__/publish-authority.spec.ts`: no AI path reaches `PUBLISHED` |
| AU-08 | Refund, payout, wallet, fee, role | never AI | Domain services | `ADMIN` | `AuditLog`, ledger | `common/__tests__/ai-no-money.spec.ts`: service identity `ai-api` receives `403` on every money, wallet, fee and role route |
| AU-09 | Prompt or policy promotion | Optimizer | Acceptance gate | `ADMIN` | `OptimizationRun` | `optimization/__tests__/promotion-authority.spec.ts` |
| AU-10 | Theme publication | `ThemeProposerService` | `validateForPublish` | `ADMIN` | `Theme` | `gamify/themes/__tests__/themes-propose.spec.ts` (exists) plus `publish` requires `ADMIN` |
| AU-11 | Scenario validity | Scenario Generator agent | `validateScenario` | Creator or reviewer | scenario row, `AuditLog` | `sandbox/__tests__/scenario-validator.spec.ts` (§7 of `06-accounting-domain.md`) |
| AU-12 | Credit price of a call | none | Tariff table in `api` applied to reported tokens | none | `AICreditLedgerEntry` | `ai-credits/__tests__/tariff.spec.ts`: a model-reported price is ignored |
| AU-13 | Tool call permission | Agent proposes calls | `api` against `ToolRegistry` and the agent allow-list | `ADMIN` for registry changes | `DecisionTrace` | `agents/__tests__/tool-validation.spec.ts` |
| AU-14 | Misconception tag | Assessment agent | Detection rules, lifecycle thresholds | none | `Misconception` | `misconception/__tests__/tag-authority.spec.ts`: an AI proposal cannot set `confirmed` |
| AU-15 | Career mapping output | Career agent | Curated dataset version and citation check | none | `DecisionTrace` | `agents/__tests__/career-citation.spec.ts`: an output without dataset citations is refused |
| AU-16 | Stage promotion | none | Stage rules (`03-actors-and-journeys.md` §2) | `ADMIN` for creator and reviewer | `StagePromotion`, `AuditLog` | `stages/__tests__/promotion.spec.ts` |
| AU-17 | Tutor explanation, hint and worked-example text | AI | none; advisory output with no state change | none | `DecisionTrace` | `tutor/__tests__/advisory-only.spec.ts`: explanation text never changes a score, mastery value, policy decision or reward |
| AU-18 | Draft content and quiz items from the Creator Assistant | AI | Validators for structure and prerequisites | Reviewer or `ADMIN` before publication (AU-07) | `ReviewItem`, `AuditLog` | `agents/__tests__/creator-assistant-draft.spec.ts`: a draft is stored as `DRAFT` and never published or priced by the agent |

---

## 3. Learner model

### 3.1 Inputs

`LearningEvent` v2 with a server-validated type, `idempotencyKey` (unique per user, exists in the schema), `tenantId`, `entityType`, `entityId`, `occurredAt`, a payload with `itemDifficulty`, `hintLevel`, `isTransfer`, `correct`. Events come from server code paths only (quiz scoring, sandbox completion, class attendance), never from a browser-written row. `POST /learning-events` ingests with `Idempotency-Key` and accepts only the types the caller may produce; `ai-api` ingests through `/internal`.

### 3.2 Mastery update (D-08)

The existing update applies `baseK = 32` to a score in 0 to 1 and an expected value that depends on difficulty only (VD VF-02). The corrected rule is Elo-like on the logistic scale:

```text
p      = 1 / (1 + exp(-(m - d) / s))
K(n)   = max(K_min, K_0 / (1 + n / n_0))
m_next = clamp(m + w * K(n) * (y - p), 0, 1)
```

`m` mastery, `d` item difficulty, `n` evidence count, `y` outcome (1 correct, 0 wrong), `w` evidence weight: independent correct or wrong 1.0, correct after a hint 0, correct after a full explanation 0, transfer success uses `d + delta_t`, off-topic 0. Parameters [ASSUMPTION, reviewed in the pilot]: `s` 0.25, `K_0` 0.15, `K_min` 0.03, `n_0` 10, `delta_t` 0.1.

Golden vectors with magnitudes (computed from the formula with those parameters); the current vectors assert only sign and bounds:

| m | d | n | y | p | K | m_next |
|---|---|---|---|---|---|---|
| 0.5 | 0.5 | 0 | 1 | 0.5000 | 0.1500 | 0.5750 |
| 0.5 | 0.5 | 0 | 0 | 0.5000 | 0.1500 | 0.4250 |
| 0.8 | 0.3 | 20 | 1 | 0.8808 | 0.0500 | 0.8060 |
| 0.8 | 0.3 | 20 | 0 | 0.8808 | 0.0500 | 0.7560 |
| 0.3 | 0.8 | 5 | 1 | 0.1192 | 0.1000 | 0.3881 |
| 0.3 | 0.8 | 5 | 0 | 0.1192 | 0.1000 | 0.2881 |
| 0.9 | 0.9 | 40 | 1 | 0.5000 | 0.0300 | 0.9150 |
| 0.1 | 0.2 | 0 | 0 | 0.4013 | 0.1500 | 0.0398 |

Confidence rises with evidence count and falls with surprise, as in the existing service (kept, tests kept). One attempt never moves the score by more than `K_0`.

### 3.3 Misconception lifecycle

| State | Entry | Exit |
|---|---|---|
| `OPEN` | A rule-detected tag from the sandbox taxonomy (`06-accounting-domain.md` §6) or an assessment proposal accepted by the rules | `CONFIRMED` after at least 2 independent occurrences in different events within `W_c` days |
| `CONFIRMED` | as above | `RESOLVING` after one independent correct answer on a matched item following the intervention |
| `RESOLVING` | as above | `RESOLVED` after `c` consecutive independent correct answers over at least `D_r` days; back to `OPEN` on recurrence |
| `RESOLVED` | as above | reopens on recurrence |

An AI proposal creates at most `OPEN` with source `AI`; only rules advance the state (AU-14).

### 3.4 Preferences and the knowledge graph

`LearningPreference(key, value, confidence, evidenceCount)`: written only when `evidenceCount >= 3` observations from separate sessions, confidence `1 - 1/(1 + n)`; one model output never writes a trait. The "learner knowledge graph" is `SubTopicPrerequisite` with a mastery overlay, not a second structure.

```python
def candidates(graph, mastery, theta):
    remediate = []
    intervene = []
    for node in graph.nodes:
        below = mastery[node] < theta
        prereqs_ok = all(mastery[p] >= theta for p in graph.prerequisites(node))
        if below and prereqs_ok:
            intervene.append(node)
        if below and not prereqs_ok:
            remediate.extend(p for p in graph.prerequisites(node) if mastery[p] < theta)
    return intervene, remediate
```

Weak-node rule: mastery below `theta` with all prerequisites at or above `theta` is an intervention candidate; a prerequisite below `theta` is remediated first. `theta` is a parameter.

---

## 4. Memory

Postgres is the source of truth; Qdrant is an index rebuilt from it.

| Layer | Table | Written by | Retention | Retrieval filter |
|---|---|---|---|---|
| Working | none (request scope) | `ai-api` | request | n/a |
| Episodic | `EpisodicMemory` | memory policy in `api` | TTL `T_epi` days | `userId`, `tenantId`, lesson or topic scope |
| Semantic | `SemanticLearnerMemory` | memory policy | until deleted | `userId`, `tenantId` |
| Procedural | `ProceduralMemory` | memory policy | until deleted | `userId`, `tenantId` |

Write policy (in `api`, test AU-06): drop greetings and short acknowledgements; drop text matched by `find_instruction_injection`; require model confidence above `c_min`; require at least 3 observations for any trait; rate-limit writes per session; set a TTL; never store the model's reasoning text. Flow: `ai-api` returns memory candidates with the run result; `api` decides, writes Postgres, enqueues an index job; `ai-api` upserts Qdrant with `memoryId`, `userId`, `tenantId`, `version` in the payload.

Retrieval is always filtered by user and tenant. Today `tool_semantic_search` is strictly lesson-scoped, `tool_semantic_search_with_fallback` returns recent items regardless of lesson and has no production caller, and the chat prompt reads memory through `memory_manager.retrieve_as_string(user_id=...)`, which has no lesson or tenant filter [VERIFIED: `utils/tools/memory.py:13-33`, `config/memory_embedding.py:121-130`, `v1/learning/service.py:114`]. The fallback function is deleted, and the chat path moves to the scoped search. Export and deletion: `GET /me/memories`, `DELETE /me/memories/:id`, `GET /me/data-export`; a delete removes the row and emits `MemoryDeleted`, which removes the vector.

---

## 5. RAG trust pipeline

States of a resource: `UPLOADED`, `QUARANTINED`, `REVIEWED`, `PUBLISHED`, `EMBEDDED`.

| Step | Rule |
|---|---|
| Upload | Existing allow-list and ownership by upload prefix; resource enters `QUARANTINED` |
| Quarantine | Extraction text scanned by `find_instruction_injection`; hits flag the resource for review; nothing is embedded |
| Review | Owner or reviewer sets `REVIEWED`; creator content follows the product review (D-12) |
| Publish | `PUBLISHED` only for resources attached to a published product or platform content |
| Embed | Qdrant payload carries `resourceId`, `chunkId`, `tenantId`, `status`, `accessScope`, `versionId` |

Retrieval filter: tenant, `status = PUBLISHED`, and entitlement (free or the user holds an `Entitlement`), plus source. Today the filter is `source = material` only (VD S-12). Prompts place untrusted text inside `<retrieved_documents trust="untrusted">` fences everywhere, including the chat prompt built in `v1/learning/service.py:88-155` which does not use segmentation today. Citations are chunk IDs resolved to titles by `api`; they are never strings written by the model (today stored as `[]`). A grounded question with zero retrieved chunks returns "no material found" and does not call the LLM. Re-indexing needed: payload fields change, the vector size does not (`EMBEDDING_DIM` 1024).

---

## 6. Agent runtime

### 6.1 AgentSpec

```python
from pydantic import BaseModel

class Budgets(BaseModel):
    max_input_tokens: int
    max_output_tokens: int
    max_wall_seconds: int
    max_tool_calls: int
    max_credits: int

class AgentSpec(BaseModel):
    agent_id: str
    version: str
    purpose: str
    input_schema: str
    output_schema: str
    allowed_tools: list[str]
    permission_class: str
    data_scope: list[str]
    model_mode: str
    budgets: Budgets
    memory_read: list[str]
    memory_write_candidates: bool
    rag_filters: dict[str, str]
    failure_behavior: str
    human_gates: list[str]
```

`ToolRegistry` is admin-managed in `api`; agents cannot register tools; `api` validates every proposed tool call against the registry and the agent allow-list before it runs. Permission classes: `READ`, `WRITE`, `EXTERNAL_ACTION`; `FINANCIAL` and `ADMIN` are never granted to an agent (`../architecture/agent-safety.md` §2).

### 6.2 Run flow

```mermaid
sequenceDiagram
  participant W as Web
  participant A as api
  participant I as ai-api
  participant L as LLM gateway
  W->>A: POST /tutor/sessions/:id/messages with Idempotency-Key
  A->>A: authorize, check allowance, reserve credits
  A->>I: POST /internal/agents/run signed, acting user, trace id
  I->>A: GET /internal/learners/:id/context signed
  I->>L: prompt within budgets
  I->>A: POST /internal/tools/validate for each proposed tool call
  I-->>A: result, chunk ids, tokens, memory candidates
  A->>A: write Episode and DecisionTrace, settle or release credits
  A-->>W: answer with citations and cost
```

`api` records the `Episode` and `DecisionTrace` from the result `ai-api` returns, so `ai-api` needs no database access (today `TutorService` writes both, but no LLM call exists in that path).

---

## 7. Agent catalog

| Agent | Can | Cannot |
|---|---|---|
| Accounting Tutor | Explain, worked examples, hints by level, Socratic questions | Grade final answers, post entries |
| Path (Curriculum) | Propose ordering inside the golden graph with a rationale | Invent topics, override the policy |
| Assessment | Analyze attempt patterns, propose misconception tags | Change scores, mastery or misconceptions directly |
| Creator Assistant | Outline, draft quiz items, draft scenarios for engine validation, check prerequisites | Publish, set prices |
| Career | Map skills to roles from a curated, dated, sourced dataset | Promise jobs, salaries or certification |
| Scenario Generator | Draft virtual-company scenarios | Mark a scenario valid |

| Spec field | Tutor | Path | Assessment | Creator Assistant | Career | Scenario Generator |
|---|---|---|---|---|---|---|
| `purpose` | explain within the lesson | rank next nodes | tag mistakes | draft content | map skills | draft scenarios |
| `allowed_tools` | `rag_search`, `sandbox_lookup_account`, `learner_context_get` | `graph_next_nodes`, `learner_context_get` | `attempt_history_get` | `rag_search`, `graph_next_nodes`, `scenario_validate` | `career_dataset_search` | `scenario_validate`, `sandbox_lookup_account` |
| `permission_class` | `READ` | `READ` | `READ` | `READ` | `READ` | `READ` |
| `data_scope` | `learner_self`, published course | `learner_self` | `learner_self` | creator's own drafts, published | public dataset | creator's own drafts |
| `model_mode` | flash | flash | flash | thinking | flash | thinking |
| budgets | `T_in`, `T_out`, 20 s, 4 tools, `C_tutor` credits | 8 s, 2 tools | 10 s, 1 tool | 60 s, 6 tools, `C_assist` | 15 s, 2 tools | 90 s, 8 tools, `C_scen` |
| memory | read episodic and semantic; propose candidates | read semantic | read episodic | none | none | none |
| `rag_filters` | tenant, `PUBLISHED`, entitlement | none | none | tenant, creator scope | none | none |
| `failure_behavior` | typed error, release credits | fall back to policy order | skip tagging | return partial draft | refuse without citation | return no draft |
| `human_gates` | none | none | none | publish by reviewer | none | creator or reviewer approves |

Budget values `T_in`, `T_out`, `C_*` are parameters set from measured cost (D-21); this file sets none.

---

## 8. Model routing

| Task | Mode | Budget per call | Fallback | Cost record |
|---|---|---|---|---|
| Tutor reply, hint, rationale | flash | `T_out` tokens | retry once, then typed `LLM_UNAVAILABLE`, release credits | tokens in and out, model, cost to `DecisionTrace` |
| Quiz generation (existing) | flash (4 s measured) | `OPENAI_MAX_TOKENS` | switch the call site to thinking if answer-key quality drops | same |
| Lesson content generation, path planning (existing) | thinking | `OPENAI_THINKING_MAX_TOKENS` | background task, Celery retry up to 3 | same |
| Scenario drafting | thinking | `T_scen` | no draft | same |
| Free-text judge | flash with rubric | `T_judge` | `PROVISIONAL` grade, no gate | same |

The measured choice on 2026-09-30 (flash `gemini/gemini-3.1-flash-lite`, thinking `deepseek-v4-flash`) lives only in `.env`; the code defaults are `gpt-4.1-mini` and `gpt-5-mini` (`config/envs.py:39-40`) [DOC-ONLY: V1 plan §3.4]. One gateway serves both modes, a single point of failure (`15-risks.md`). Costs are logged per run so the guardrail G-6 is computable.

---

## 9. Service authentication migration

Target contract (ADR-007): signed headers `x-service-id`, `x-service-timestamp`, `x-service-signature`, `x-trace-id`, `x-idempotency-key` (all non-GET), `x-acting-user-id`; `api` re-authorizes the acting user. The replay cache moves from the in-process `Map` (`internal-service.guard.ts:42`) to Redis before more than one `api` replica runs.

| Today (forwards the user token) | `/internal` replacement |
|---|---|
| `GET /curriculum/lessons/{id}` | `GET /internal/lessons/:id` |
| `GET /curriculum/steps?lessonId=` and `/steps/{id}` | `GET /internal/steps` |
| `GET /curriculum/topics?id=` | `GET /internal/topics/:id` |
| `GET /learning/user-steps/{id}` | `GET /internal/user-steps/:id` |
| `GET /learning/learning-styles/{id}` | `GET /internal/learners/:id/context` |
| `GET/POST /learning/personality-quizzes` | `GET/POST /internal/personality-quizzes` |
| `GET/POST/PATCH /chat/chat-messages` | `POST /internal/chat-messages`, `PATCH /internal/chat-messages/:id` |
| `GET /chat/contents/similarity`, `POST /chat/contents` | `GET /internal/contents/similarity`, `POST /internal/contents` |
| none | `POST /internal/episodes`, `/internal/decision-traces`, `/internal/memories/candidates`, `GET /internal/rag/published-resources`, `POST /internal/tools/validate`, `POST /internal/credits/reservations` |

User-facing routes that stay on `ai-api` validate the caller through `GET /auth/profile` on every route, not only on resources (stage 0 fix for VF-07). Credit-spending calls go through `api` (D-13). Tokens leave Celery arguments and BullMQ job data; jobs carry `actingUserId` only (VD VF-17).

---

## 10. Evaluation and self-improvement

| Loop | Cadence | What changes | Gate |
|---|---|---|---|
| Fast | per interaction | Learner mastery, misconception state, memory candidates | Rules in §3 and §4 |
| Medium | weekly | Policy parameters (strategy preference weights) | Offline replay on stored episodes; human approval |
| Slow | monthly at most | Prompt versions | Frozen benchmark, acceptance gate, canary, rollback, human approval |

Preconditions before any optimizer (D-10); current state from the verified inventory:

| Precondition | State |
|---|---|
| Episode writer live | partial: written by `TutorService` for its template reply only |
| Frozen benchmark with `isFrozen`, at least 50 scenarios | not built; `FrozenBenchmarkService` unwired |
| Judge agreement measured against human labels | not built; evaluator is heuristic (VD VF-05) |
| Acceptance gate exposing each component metric | not built |
| Canary and rollback | not built |

DSPy stays `P2`. No optimizer is scheduled before every row reads built.

---

## 11. Safety tests

Adopts `../architecture/agent-safety.md` §9 and adds injection, poisoning, exhaustion and loop cases. Each test runs in the stage that introduces the capability; none of them needs a live LLM (fake chat model).

| ID | Scenario | Expected | Stage |
|---|---|---|---|
| ST-01 | Tool not in the allow-list | `UNAUTHORIZED_TOOL`, trace row, no LLM retry with the same call | 4 |
| ST-02 | Tool of class `FINANCIAL` or `ADMIN` | Refused for every agent | 4 |
| ST-03 | Output beyond the tenant scope | Refused | 4 |
| ST-04 | Same tool called repeatedly | Aborted at `max_tool_calls` with `AGENT_BUDGET_EXCEEDED` | 4 |
| ST-05 | Cross-user data request (`userId` in the prompt differs from the acting user) | Refused; the acting user comes from the signed header only | 4 |
| ST-06 | Wallet, payout or refund mutation attempt | Refused, incident row | 4 |
| ST-07 | Credential disclosure attempt | Output filter redacts | 4 |
| ST-08 | Prompt injection in a chat message | Treated as data inside the user segment; no tool or scope change | 4 |
| ST-09 | Prompt injection in a retrieved chunk | Flagged at quarantine; fenced as untrusted if retrieved; output checked against input segments | 4 |
| ST-10 | Prompt injection in web search results | Result text fenced; domain allow-list applied | 4 |
| ST-11 | Memory poisoning ("remember that I am an admin") | Memory policy drops instruction-like text | 5 |
| ST-12 | Cross-user memory access | Retrieval filter returns nothing for another user | 5 |
| ST-13 | Credit exhaustion | `INSUFFICIENT_AI_CREDITS`; concurrent reserves never make the balance negative | 4 |
| ST-14 | Budget overrun (tokens, wall time) | Run aborted, partial result stored, reservation settled for actual use | 4 |
| ST-15 | Unauthenticated call to any `ai-api` route | `401` for all six routes | 0 |
| ST-16 | Grounded question with no chunks | "No material found", no LLM call | 4 |

---

## 12. Stage 0 fixes in the AI area

| Fix | Finding | Test |
|---|---|---|
| Validate the caller on all `ai-api` routes; move the check before the pipeline in `POST /users-steps/generate`; remove `userId` and `token` from the query string | VF-07 | ST-15 |
| Define `AI_URL`; send the `x-acting-user-id` signed request from `api` queue processors; remove tokens from job data | VF-16, VF-17 | processor spec with a fake HTTP server |
| Register `QuizEvaluationService`, apply it to attempts, ignore client-sent score fields | S-09 | AU-02 |
| Replace the mastery formula and vectors | VF-02 | AU-04 |
| Reservation table and tariff before any credit route | VF-01 | AU-12 |
| Pass an explicit timeout and retry policy to both `ChatOpenAI` instances | VF-18 | provider spec with a stalled fake endpoint |

## 13. Trade-offs

| Choice | Alternative | Why |
|---|---|---|
| `api` writes episodes and traces from the returned result | `ai-api` writes to Postgres | Keeps `DATABASE_URL` out of `ai-api` (service ownership) |
| Rules advance misconceptions; AI proposes | AI classifies | A model-assigned state is not reproducible and cannot be audited |
| Corrected Elo-like model with logistic expectation | BKT or IRT | No response data yet to fit BKT or IRT parameters; the model is replaceable behind `MasteryService` |
