# AI Agent Audit — services/ai-api

**Scope:** Phase 0 master-prompt §36–§40, §86, §89–§90. Agent Runtime layer.
**Audit date:** 2026-10-05.
**Service container:** `reducera_ai_api` :3003. **Source of truth:** `services/api` :3002 (NestJS).
**Evidence rule:** every claim cites a file and line range, or `MISSING` is stated.

---

## 1. Headline Verdict

The `v1/agents/` layer is a **thin deterministic dispatcher over three pre-LLM shims and three LangGraph linear DAGs**. There is **no agent loop** in the master-prompt §36 sense (Observe → Interpret → Plan → Act → Validate → Reflect → Respond). There is **no tool registry** (`toolId, permissionClass, sideEffects, requiredScopes, riskLevel` are all `MISSING`). There is **no runtime permission enforcer** — tools are bare module-level functions imported directly into LangGraph node bodies. There is **no agent budget** (`max_iterations`, `max_steps`, `max_wall`, `max_tokens`, `max_cost` are all `MISSING`). The LangGraph "agent" graphs are linear pre-defined DAGs with no iteration, no back-edges, and no Validate/Reflect nodes. Two of the five advertised agents (`tutor_agent`, `assessment_agent`) are silent aliases that delegate to `run_curriculum` — they are not implementations. The LLM streaming explanation that the comment in `curriculum_agent.py:8-9` promises is **not present**; the function is HTTP-only. The decision-trace POST at `router_endpoint.py:65-87` uses raw `Authorization` + `x-idempotency-key` instead of the signed `send_signed` contract that the foundation audit already ships.

## 2. Agent Dispatcher (`v1/agents/router.py`)

| Item | Status | Evidence |
|---|---|---|
| Intent-to-agent mapping as plain dict | PRESENT | `v1/agents/router.py:7-13` (`INTENT_TO_AGENT`) |
| `dispatch(intent)` returns agent name | PRESENT | `v1/agents/router.py:18-21` |
| `intent_for_agent(name)` reverse lookup | PRESENT | `v1/agents/router.py:24-28` |
| `list_intents()` enumeration | PRESENT | `v1/agents/router.py:31-32` |
| Dispatcher is deterministic (no LLM) | PRESENT | `v1/agents/router.py:1-32` (no `pipeline.llm` import, no model call) — test guards this at `__tests__/test_router_dispatch.py:22-27` |
| Unknown intent raises `ValueError` | PRESENT | `v1/agents/router.py:19-20` |
| Dispatcher carries per-route policy (allow-list, risk gate) | **MISSING** | no metadata beside a string name; no per-intent risk class, no scope, no SLA |

## 3. Implemented Agents (`v1/agents/`)

| Item | Status | Evidence |
|---|---|---|
| `curriculum_agent.run_curriculum` exists | PRESENT | `v1/agents/curriculum_agent.py:16-50` (50 lines, 3 outbound HTTP calls) |
| `career_agent.run_career` exists | PRESENT | `v1/agents/career_agent.py:7-38` (2 HTTP GETs + sha256 hash) |
| `creator_assistant_agent.run_creator_assistant` exists | PRESENT | `v1/agents/creator_assistant_agent.py:7-41` (3 HTTP GETs + sha256 hash) |
| `tutor_agent` is a real implementation | **MISSING** | `v1/agents/router_endpoint.py:46-48` — `tutor_agent` calls `run_curriculum`. There is no `tutor_agent.py` file. |
| `assessment_agent` is a real implementation | **MISSING** | `v1/agents/router_endpoint.py:56-58` — `assessment_agent` calls `run_curriculum`. There is no `assessment_agent.py` file. |
| `run_curriculum` streams an LLM explanation | **MISSING** | `v1/agents/curriculum_agent.py:16-50` does HTTP only; no LLM import. Comment at lines 8-9 explicitly states: "The LLM streaming explanation is wired in Phase 7 (LangGraph). For Phase 2 the deterministic scaffolding is in place." |
| `run_curriculum` requires `fetcher` parameter | PRESENT (defect) | `v1/agents/curriculum_agent.py:21` (no default). Called without it at `v1/agents/router_endpoint.py:47, 54, 57` — would raise `TypeError` at runtime if hit. Masked in tests because `__tests__/test_router_endpoint.py:16` patches `run_curriculum`. |
| Agents raise on HTTP failure | **MISSING** | `career_agent.py:17-22` and `creator_assistant_agent.py:17-24` never call `raise_for_status`; an HTTP 5xx is silently swallowed. `curriculum_agent.py:28, 36, 47` does call `raise_for_status` (the only agent that does). |
| Agents recognize failure and refuse to fabricate | **MISSING** | `career_agent.py:29-37` and `creator_assistant_agent.py:27-40` always return a populated dict even when both upstream calls errored |
| Agent package `__init__.py` re-exports agents | PARTIAL | `v1/agents/__init__.py:7` exports only `run_curriculum`; `run_career` and `run_creator_assistant` are imported only by `router_endpoint.py:8-9`, not by the package |
| `run_curriculum` accepted into `run_curriculum` symbol only — no `tutor_agent` / `assessment_agent` symbol exists | **MISSING** | `v1/agents/__init__.py:1-9` |

## 4. Agent Loop Architecture (master-prompt §36)

| Item | Status | Evidence |
|---|---|---|
| `Observe` step in any agent | **MISSING** | `v1/agents/curriculum_agent.py`, `career_agent.py`, `creator_assistant_agent.py` — none implement Observe. They are single-pass HTTP calls. |
| `Interpret` step | PARTIAL | `v1/agents/career_agent.py:24-26` sorts mastery; `v1/agents/creator_assistant_agent.py:36-40` counts; `v1/agents/curriculum_agent.py:27-48` makes a policy call. None of these *interpret* in the LLM sense. |
| `Plan` step | **MISSING** | grep for `Plan` against `v1/agents/*.py` returns no matches |
| `Act` step | PRESENT (trivial) | each agent makes HTTP calls |
| `Validate` step | **MISSING** | grep for `Validate` against `v1/agents/*.py` returns no matches |
| `Reflect` step | **MISSING** | grep for `Reflect` against `v1/agents/*.py` returns no matches |
| `Respond` step | PRESENT | `router_endpoint.py:89` returns the dict |
| Loop / iteration | **MISSING** | none of the three agents has any `while`, `for`, retry, or back-edge. They execute once. |

## 5. LangGraph State Graphs (master-prompt §36 → §37)

| Graph | Nodes | Edges | Is it an agent loop? | Evidence |
|---|---|---|---|---|
| `content_pipeline.generate_content_material_pipeline` | 3 | 3 (linear) | **NO** | `v1/learning/content_pipeline.py:254-262` — `parallel_fetch → prepare_learning_context → generate_material → END` |
| `generate_user_steps_pipeline.build_graph` | 7 | 7 (linear) | **NO** | `v1/users_steps/generate_user_steps_pipeline.py:372-395` — `fetch → personality_material_builder → build_context → read_memory → semantic_search → external_search → generate → END` |
| `generate_quiz_pipeline.user_steps_pipeline` | 3 | 3 (linear) | **NO** | `v1/users_steps/generate_quiz_pipeline.py:157-164` — `parallel_fetch → process_results → analyze_text → END` |
| Any back-edge / conditional edge / loop edge | **MISSING** | — | — | all three graphs use only `add_edge` (deterministic), no `add_conditional_edges` |
| Any node that retries a failed sub-task | **MISSING** | — | — | all node bodies are single-pass |
| Any node with a `Plan` / `Validate` / `Reflect` semantic | **MISSING** | — | — | node names describe data flow, not cognitive step |
| `RecursionLimit` enforced on the compiled graph | **MISSING** | — | — | `v1/learning/content_pipeline.py:264-266`, `v1/users_steps/generate_user_steps_pipeline.py:395-397`, `v1/users_steps/generate_quiz_pipeline.py:165` — all use default `recursion_limit=25` (LangGraph default), never overridden |
| Per-step validation of intermediate state | **MISSING** | — | — | no `pydantic.validator` or type-guard in any node body |

## 6. Tool Registry (master-prompt §37)

| Item | Status | Evidence |
|---|---|---|
| Registry that declares `toolId, name, description, permissionClass, inputSchema, outputSchema, sideEffects, requiredScopes, timeout, cost, riskLevel, enabled` | **MISSING** | `grep -rn "tool_registry\|toolId\|permissionClass\|sideEffects\|riskLevel\|requiredScopes" services/ai-api/` returns no matches (excluding `.venv`) |
| Tools declared as module-level functions with no metadata | PRESENT | `utils/tools/memory.py:13, 23, 81, 103` and `utils/tools/web_search.py:13` — plain `def tool_*` functions, no decorator, no registration call |
| Tools are imported directly into graph node bodies | PRESENT | `v1/learning/content_pipeline.py:8-9` imports `tool_memory_upsert, tool_semantic_search, tool_web_search`; `v1/users_steps/generate_user_steps_pipeline.py:14-16` imports `*` from both `utils.tools.memory` and `utils.tools.web_search` |
| Tool count in the codebase | 5 | `utils/tools/memory.py` (`tool_semantic_search`, `tool_semantic_search_with_fallback`, `tool_memory_upsert`, `tool_memory_read`) + `utils/tools/web_search.py` (`tool_web_search`) |
| Permission classes (READ / WRITE / EXTERNAL_ACTION / FINANCIAL) declared anywhere | **MISSING** | no `class Permission` or string-typed `permission_class` attribute in any tool file |
| Central enforcer for tool permissions | **MISSING** | no `tool_dispatcher.py`, no `runtime.permission_check()` call; nothing reads a tool's class before invocation |

## 7. Tool Sandboxing

| Item | Status | Evidence |
|---|---|---|
| Agent runtime rejects unauthorized tool calls | **MISSING** | no runtime check; tools are plain Python functions called by graph nodes |
| LLM is the only "guard" | PRESENT but **INERT** | no LLM is even called in `run_curriculum`, `run_career`, `run_creator_assistant`; `v1/agents/curriculum_agent.py:16-50` does not invoke any LLM at all |
| Tool calls per episode are bounded | **MISSING** | no counter; nothing caps `tool_memory_upsert` or `tool_web_search` per run |
| Web tool rejects non-allowlisted domains | **MISSING** | `utils/tools/web_search.py:13-43` passes user query straight to Tavily; no `url_allowlist.py` import, no domain filter on returned results |
| Web tool URL validator | **MISSING** | only filter is `looks_like_instruction` (instruction-pattern detector) at `utils/tools/web_search.py:37` |
| Web tool timeout | PRESENT | `utils/tools/web_search.py:22` (`timeout=10`) |
| Web tool content-type validation | **MISSING** | no check that Tavily returned `application/json` or that `data["results"]` exists before iterating |
| Web tool injection isolation | PARTIAL | `utils/tools/web_search.py:37-39` rejects results whose `title` or `content` matches `looks_like_instruction` (defensive against instruction-injection from search results). The query itself is not isolated. |
| Web tool trace_id | **MISSING** | no `x-trace-id` header attached to the Tavily POST |
| Web tool cost / token capture | **MISSING** | no metric recorded |

## 8. Agent Execution Contract (master-prompt §41)

| Field | Status | Evidence |
|---|---|---|
| `traceId` | PARTIAL | generated by `config/service_auth.py:54` (`uuid4()`) when ai-api makes outbound signed calls, but the agent endpoint does not generate one for its own run. `router_endpoint.py:65-87` posts decision-trace without an `x-trace-id` header |
| `episodeId` | **MISSING** | no episode creation anywhere in `v1/agents/` |
| `promptVersion` | **MISSING** | `router_endpoint.py:69-78` sends only `promptHash` (sha256 of raw query string) — not a versioned prompt id; foundation audit already flags this in §10 |
| `policyVersion` | **MISSING** | not in any agent payload |
| `learnerStateVersion` | **MISSING** | not in any agent payload |
| `retrievalVersion` | **MISSING** | not in any agent payload |
| `toolCalls` | PRESENT | `router_endpoint.py:75` (only for `career_agent` and `creator_assistant_agent`; `curriculum_agent` does not record tool calls) |
| `inputTokens` | **MISSING** | no LLM call in agents; even where LLM is called (`content_pipeline.py:77, 219`), no token counter is captured |
| `outputTokens` | **MISSING** | same as above |
| `cost` | **MISSING** | no cost record |
| `latency` | **MISSING** | no per-episode latency capture in `router_endpoint.py` |
| `response` | PRESENT | `router_endpoint.py:89` returns the dict |
| `validation` | **MISSING** | no validation step in any agent |
| `evaluation status` | **MISSING** | no evaluation step |
| Deterministic outputs (replay-safe) | PARTIAL | `router_endpoint.py:76` sends `deterministicOutputs`, but `run_curriculum` returns `{"decision", "memory", "stored"}` which are not deterministic — they come from live api calls |

## 9. Agent Failure Boundary (master-prompt §86)

| Item | Status | Evidence |
|---|---|---|
| Agent returns 502 / structured error on tool failure | **MISSING** | `career_agent.py:17-22` never calls `raise_for_status`; both upstream calls can return 5xx and the agent still returns 200 |
| Agent refuses to fabricate when retrieval fails | **MISSING** | `creator_assistant_agent.py:39` does `earnings.get("available")` on whatever shape earnings has — if `earnings` is `None` or a non-dict, this raises `AttributeError`. No fallback. |
| Bare `except:` in graph nodes | PRESENT | `v1/learning/content_pipeline.py:37-39` (learning-style fetch), `:44-45` (user-step fetch), `:92-94` (history), `:136-137` (RAG), `:148-149` (web) — all bare `except:` returning empty defaults |
| Bare `except:` in personality material builder | PRESENT | `v1/users_steps/generate_user_steps_pipeline.py:163-164` — wraps `json.dumps` |
| Bare `except:` in quiz pipeline | PRESENT | `v1/users_steps/generate_quiz_pipeline.py:152-153` — returns `QuizResponse(quiz=[])` on any failure, regardless of cause |
| LLM-call wrapped in `try/except` with degraded fallback | PRESENT (mixed) | `v1/learning/content_pipeline.py:76-81, 218-225` — yes, with English fallback text; `v1/users_steps/generate_user_steps_pipeline.py:211-251, 340-369` — yes, with Indonesian fallback |
| Caller told which fallback fired | **MISSING** | fallback string is returned to caller as if it were the real answer; no `state.fallback=True` flag, no `degraded=True` envelope field |
| Idempotent retry of failed sub-task | **MISSING** | no retry decorator, no tenacity wrapper, no `@backoff` |

## 10. Maximum Agent Budgets (master-prompt §90)

| Budget | Status | Evidence |
|---|---|---|
| `max_tool_calls` per episode | **MISSING** | grep for `max_tool_calls` returns no matches; nothing counts or caps tool invocations |
| `max_iterations` per episode | **MISSING** | LangGraph default `recursion_limit=25` is used at `v1/learning/content_pipeline.py:265`, `v1/users_steps/generate_user_steps_pipeline.py:395`, `v1/users_steps/generate_quiz_pipeline.py:165`; never lowered, never exposed as env |
| `max_wall_time` per episode | **MISSING** | no wall-clock check; the `httpx.AsyncClient` in agents has no deadline. LLM call timeout is `LLM_TIMEOUT_SECONDS=60` (`config/providers.py:18, 122-125`) but it does not bound the whole episode |
| `max_token_budget` per episode | **MISSING** | no token counter; `config/providers.py:18-19` defines `LLM_MAX_RETRIES=2` and `LLM_TIMEOUT_SECONDS=60` but no token cap |
| `max_cost` per episode | **MISSING** | no cost counter |
| Per-episode cap propagated to the user as 429 | **MISSING** | no rate limit at the agent layer (foundation audit §9 confirms `/v1/agents/run` has no `@rate_limit`) |

## 11. Agent Observability (master-prompt §93)

| Item | Status | Evidence |
|---|---|---|
| `trace_id` survives the entire run | **MISSING** | no trace_id is generated at agent-request ingress. `router_endpoint.py:22-89` accepts the request, dispatches, and returns — no `request.state.trace_id` is set. |
| `trace_id` propagated to outbound HTTP calls | PARTIAL | `config/service_auth.py:54` generates a fresh `uuid4()` per outbound signed call — but the agent endpoint at `router_endpoint.py:65-87` uses raw `httpx.AsyncClient` (line 65), **not** `send_signed`. So no trace_id flows out of the agent endpoint. |
| `trace_id` propagated to LLM call | **MISSING** | `v1/learning/content_pipeline.py:77, 219` calls `pipeline.llm.invoke` without any trace context |
| `trace_id` propagated to web / Tavily call | **MISSING** | `utils/tools/web_search.py:22` posts to Tavily with no `x-trace-id` header |
| End-to-end trace_id in decision-trace POST | **MISSING** | `router_endpoint.py:65-87` headers are `Authorization` + `x-idempotency-key` only |
| Decision-trace POST failures silently logged | PRESENT | `router_endpoint.py:83-87` — `except Exception as e: logging.warning(...)`; no retry, no surfacing to caller |
| OTel / OpenTelemetry instrumentation | **MISSING** | per foundation audit §7 — `pyproject.toml:7-30` has no OTel dep; `main.py` registers no instrumentation |

## 12. Internal Contract as SENDER vs RECEIVER (per `AGENTS.md`)

| Item | Status | Evidence |
|---|---|---|
| ai-api as SENDER — HMAC-SHA256 signed headers implemented | PRESENT | `config/service_auth.py:9-60` — `SERVICE_ID = "ai-api"`, `signed_headers()`, `send_signed()` |
| Agent endpoint uses `send_signed` for its decision-trace POST | **MISSING** | `router_endpoint.py:64-87` uses raw `httpx.AsyncClient` with raw `Authorization` (the user's JWT) and an `x-idempotency-key`. The signed service contract is not applied here. |
| Agent endpoint passes `INTERNAL_AI_API_SECRET`-derived signature | **MISSING** | same as above |
| ai-api as RECEIVER — middleware that verifies signed calls from `services/api` | **MISSING** | `main.py:1-42` registers CORS, 404 handler, and includes two routers — no signed-call verification middleware. The internal contract is one-way: ai-api signs out, but never signs in. |
| `services/api` could legitimately call ai-api over a signed contract | **MISSING** | no receiver in `main.py`, no `verify_signature()` function, no `INTERNAL_AI_API_SECRET` used for receiving |

## 13. Tool Surface (What Tools Actually Exist)

| Tool | File | What it does | Failure mode | Risk class declared | Evidence |
|---|---|---|---|---|---|
| `tool_semantic_search` | `utils/tools/memory.py:13-20` | vector recall filtered by `lessonId` | returns `[]` | **MISSING** | `utils/tools/memory.py:40-78` |
| `tool_semantic_search_with_fallback` | `utils/tools/memory.py:23-37` | same, with cross-lesson fallback | logs WARNING, returns fallback | **MISSING** | `utils/tools/memory.py:23-37, 63-68` |
| `tool_memory_upsert` | `utils/tools/memory.py:81-100` | store a memory entry, reject instruction-like text | logs ERROR, returns | **MISSING** | `utils/tools/memory.py:81-100` |
| `tool_memory_read` | `utils/tools/memory.py:103-133` | raw memory read | logs ERROR, returns `[]` | **MISSING** | `utils/tools/memory.py:103-133` |
| `tool_web_search` | `utils/tools/web_search.py:13-43` | Tavily search, filter injection-like results | returns `""` | **MISSING** | `utils/tools/web_search.py:13-46` |

All five are module-level functions. None has a docstring that declares its risk class, none is wrapped in a registry, none is gated by anything besides the bare `except:` clauses inside their own bodies.

## 14. Agent-Layer Test Coverage

| Test | Path | What it asserts | Gaps |
|---|---|---|---|
| `test_curriculum_agent` | `v1/agents/__tests__/test_curriculum_agent.py:1-86` | `run_curriculum` calls `/v1/personalization/policy/next`, `/v1/personalization/memory`, forwards `Authorization` header | does NOT test LLM streaming (because there is none); does NOT test failure mode |
| `test_router_dispatch` | `v1/agents/__tests__/test_router_dispatch.py:1-42` | `dispatch()` returns the right agent name; rejects unknown intent; does not call LLM; `intent_for_agent` round-trips | does NOT test that `tutor_agent` and `assessment_agent` are aliases (and intentionally cannot — they are not real implementations) |
| `test_router_endpoint` | `v1/agents/__tests__/test_router_endpoint.py:1-72` | requires `Idempotency-Key >= 8`, requires `Bearer`, rejects unknown intent, returns decision with idempotency key | patches `run_curriculum` so the missing-`fetcher` bug at `router_endpoint.py:47` is masked; does NOT test that `career_agent` and `creator_assistant_agent` paths are reached; does NOT test decision-trace failure surfacing |
| `test_memory` | `utils/tools/__tests__/test_memory.py` | file exists | collect-ignored by `pyproject.toml:43-44` per foundation audit §14 |
| `test_memory_lesson_scope` | `utils/tools/__tests__/test_memory_lesson_scope.py` | file exists | foundation audit §14 confirms PRESENT |
| `test_web_search` | **MISSING** | — | no test file for `web_search.py` |
| Tool-permission / sandbox test | **MISSING** | — | no registry → no tests to write |
| Budget / max-iteration test | **MISSING** | — | no budget → no tests to write |
| Trace-propagation test | **MISSING** | — | no trace → no tests to write |

## 15. Critical Defects (agent layer)

| Severity | Defect | Location |
|---|---|---|
| CRITICAL | `tutor_agent` and `assessment_agent` are silent aliases of `run_curriculum`; no real implementations exist | `v1/agents/router_endpoint.py:46-48, 56-58` |
| CRITICAL | `run_curriculum` is called at `router_endpoint.py:47, 54, 57` without the required `fetcher` parameter; would raise `TypeError` at runtime — masked by `__tests__/test_router_endpoint.py:16` | `v1/agents/curriculum_agent.py:21` ↔ `v1/agents/router_endpoint.py:47, 54, 57` |
| CRITICAL | Comment in `curriculum_agent.py:8-9` claims LLM streaming is "wired in Phase 7" but no LLM import exists; the entire "tutor" experience is HTTP-only policy + memory write | `v1/agents/curriculum_agent.py:8-9, 16-50` |
| CRITICAL | `career_agent` and `creator_assistant_agent` never call `raise_for_status`; an HTTP 5xx is silently swallowed and the agent returns 200 with stale or empty data | `v1/agents/career_agent.py:17-22`, `v1/agents/creator_assistant_agent.py:17-24` |
| CRITICAL | No tool registry, no permission class, no runtime enforcer; the master-prompt §37 surface is entirely absent | `grep -rn "tool_registry\|permissionClass\|riskLevel" services/ai-api/` → 0 matches |
| HIGH | No agent loop (Observe → Interpret → Plan → Act → Validate → Reflect → Respond); the three agents are single-pass HTTP calls | `v1/agents/curriculum_agent.py:16-50`, `v1/agents/career_agent.py:7-38`, `v1/agents/creator_assistant_agent.py:7-41` |
| HIGH | LangGraph "agent" graphs are linear pre-defined DAGs with no iteration, no back-edges, no conditional edges, no `Plan`/`Validate`/`Reflect` nodes | `v1/learning/content_pipeline.py:254-262`, `v1/users_steps/generate_user_steps_pipeline.py:372-395`, `v1/users_steps/generate_quiz_pipeline.py:157-164` |
| HIGH | No budget enforcement: no `max_tool_calls`, no `max_iterations`, no `max_wall_time`, no `max_token_budget`, no `max_cost` | grep returns 0 matches across `v1/agents/`, `v1/learning/`, `v1/users_steps/` |
| HIGH | Agent endpoint decision-trace POST does not use the signed `send_signed` contract; uses raw `Authorization` (user JWT) instead | `v1/agents/router_endpoint.py:64-87` |
| HIGH | Agent execution contract (§41) emits only `traceId` (partial), `toolCalls` (partial), `response`; missing `episodeId`, `promptVersion`, `policyVersion`, `learnerStateVersion`, `retrievalVersion`, `inputTokens`, `outputTokens`, `cost`, `latency`, `validation`, `evaluation status` | `v1/agents/router_endpoint.py:65-89` |
| MEDIUM | Bare `except:` in all three LangGraph state graphs silently mask API failures as empty results | `v1/learning/content_pipeline.py:37-39, 44-45, 92-94, 136-137, 148-149`; `v1/users_steps/generate_user_steps_pipeline.py:163-164`; `v1/users_steps/generate_quiz_pipeline.py:152-153` |
| MEDIUM | `web_search` has no domain allow-list, no URL validator, no `x-trace-id` propagation, no cost / token capture | `utils/tools/web_search.py:13-46` |
| MEDIUM | `creator_assistant_agent` reads `earnings.get("available")` without checking that `earnings` is a dict; will raise `AttributeError` on a 5xx | `v1/agents/creator_assistant_agent.py:39` |
| MEDIUM | `__init__.py` re-exports only `run_curriculum`; the other two agents are reachable only via the literal path | `v1/agents/__init__.py:7` |
| LOW | LangGraph `recursion_limit` is left at the framework default of 25; never tightened to a project budget | `v1/learning/content_pipeline.py:265`, `v1/users_steps/generate_user_steps_pipeline.py:395`, `v1/users_steps/generate_quiz_pipeline.py:165` |

## 16. Evidence Trail Summary

| Cluster (foundation) | Files | What's confirmed in this audit |
|---|---|---|
| Cluster 24 (services, 20 members, `v1/agents/*`) | `v1/agents/router.py`, `v1/agents/router_endpoint.py`, `v1/agents/curriculum_agent.py`, `v1/agents/career_agent.py`, `v1/agents/creator_assistant_agent.py`, `v1/agents/__init__.py` | dispatcher is deterministic, 3 agent shims, 2 of 5 advertised agents are aliases, no LLM streaming, missing `fetcher` at call site, no agent loop |
| Cluster 31 (services, 21 members, prompt-segmentation + memory tool) | `utils/tools/memory.py`, `config/prompt_segmentation.py` | memory tool is a module-level function with no metadata; injection-defense is the only built-in guard |
| Cluster 0 (services, 33 members) | `v1/learning/content_pipeline.py`, `v1/users_steps/generate_user_steps_pipeline.py`, `v1/users_steps/generate_quiz_pipeline.py` | 3 LangGraph state graphs, all linear DAGs, no iteration, bare `except:` in every node |
| Cluster 10 (services, 14 members, `config/service_auth.py`) | `config/service_auth.py` | signed-headers SENDER is built; agent endpoint does not use it for decision-trace POST; no RECEIVER in `main.py` |
| `utils/tools/web_search.py` | standalone | no domain allow-list, no URL validator, no trace, 10s timeout only |

## 17. What Phase 6/7 Must Build (agent layer)

```text
1.  Implement real `tutor_agent` and `assessment_agent` (replace the `run_curriculum` aliases)
    with distinct policies; today both aliases and the explicit `curriculum_agent` collapse
    to the same HTTP scaffold
2.  Implement the master-prompt §36 loop in each agent: Observe → Interpret → Plan →
    Act → Validate → Reflect → Respond, with explicit node bodies (not just a single
    HTTP pass)
3.  Wire LLM streaming into `run_curriculum` (and add a real `tutor_agent`); the comment
    at curriculum_agent.py:8-9 says "Phase 7" — make Phase 7 do it
4.  Add `Plan` and `Validate` and `Reflect` steps to the three LangGraph state graphs
    in v1/learning/content_pipeline.py, v1/users_steps/generate_user_steps_pipeline.py,
    v1/users_steps/generate_quiz_pipeline.py
5.  Build the tool registry required by master-prompt §37: a `Tool` dataclass with
    `toolId, name, description, permissionClass, inputSchema, outputSchema, sideEffects,
    requiredScopes, timeout, cost, riskLevel, enabled`; a central dispatcher that
    resolves a tool by name and refuses to invoke it if `permissionClass` is not in
    the caller's scope
6.  Wrap each existing tool (`tool_semantic_search`, `tool_semantic_search_with_fallback`,
    `tool_memory_upsert`, `tool_memory_read`, `tool_web_search`) in the registry and
    declare its risk class; replace direct imports in graph nodes with
    `registry.invoke("tool_id", ...)` calls
7.  Enforce the budget from master-prompt §90: per-episode `max_tool_calls`,
    `max_iterations` (override the LangGraph default `recursion_limit`), `max_wall_time`,
    `max_token_budget`, `max_cost`; surface a 429 envelope to the caller when any
    budget is exceeded
8.  Switch the decision-trace POST in router_endpoint.py:64-87 from raw `httpx.AsyncClient`
    to `config.service_auth.send_signed`; attach `x-trace-id`, `x-idempotency-key`,
    `x-acting-user-id` so the api-side can verify the service identity
9.  Generate a `trace_id` at agent-request ingress (router_endpoint.py), inject it into
    the agent run, propagate it into every LLM call, every tool call, and the
    decision-trace POST; end-to-end trace_id is required by master-prompt §93
10. Fix the `fetcher` parameter contract: either default it in `run_curriculum` or
    inject it in `router_endpoint.py`; today the test masks a runtime `TypeError`
11. Make `career_agent` and `creator_assistant_agent` call `raise_for_status` (or a
    typed retry policy) and refuse to fabricate when an upstream call fails;
    return a typed `degraded=True` envelope so the caller can distinguish
    real answers from fallbacks
12. Replace bare `except:` blocks in v1/learning/content_pipeline.py,
    v1/users_steps/generate_user_steps_pipeline.py, v1/users_steps/generate_quiz_pipeline.py
    with typed `except (httpx.HTTPError, LangChainError, TimeoutError)` and
    surface the failure to the caller
13. Add a domain allow-list + URL validator to `utils/tools/web_search.py`; propagate
    `x-trace-id` and capture Tavily cost / result count per call
14. Add a `verify_signature` middleware to `services/ai-api/main.py` so internal
    signed calls from `services/api` are accepted (today ai-api is one-way SENDER;
    a RECEIVER is required for the symmetric contract per AGENTS.md)
15. Extend the agent execution contract to emit `episodeId`, `promptVersion`,
    `policyVersion`, `learnerStateVersion`, `retrievalVersion`, `inputTokens`,
    `outputTokens`, `cost`, `latency`, `validation`, `evaluation status` for every
    run, not just `promptHash` + `responseHash` + `toolCalls`
```
