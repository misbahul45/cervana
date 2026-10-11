# Agent Audit — Runtime, Tools, Budgets

> **Status**: `stable` · **Owner**: `ml-lead` · **Last reviewed**: `2026-10-09`
>
> Whether the system contains a bounded agent runtime or only linear generation pipelines.

---

## Scope

Every construct that decides, plans or acts on behalf of a learner: the ai-api agent endpoint and dispatcher, the three LangGraph pipelines, the tutor package's runtime and tool registry, the api's deterministic tutor, and the web pages that call agents. Verified against the seven-step loop (observe, interpret, plan, act, validate, reflect, respond) and the requirements for a tool registry, permissions, budgets, allowed tools, data scope, failure behavior and human gates.

## Findings

### Verdict on the question "agent or pipeline?"

The system contains **linear generation pipelines and a deterministic dispatcher**. It does not contain an agent loop. Evidence:

| Check | Result | Evidence |
|---|---|---|
| Graphs with branching, loops or tool nodes | none: three `StateGraph`s, all `add_edge` only | `services/ai-api/v1/learning/content_pipeline.py:416-425`, `v1/users_steps/generate_quiz_pipeline.py:193-200`, `v1/users_steps/generate_user_steps_pipeline.py:404-420`; no `add_conditional_edges`, `ToolNode`, `bind_tools`, `create_react_agent` or `recursion_limit` in the service |
| LLM chooses the next step or a tool | no | the only routing is `dispatch(intent)`, a dict lookup (`v1/agents/router.py:7-13`) |
| Any `v1/agents` module calls an LLM | no | grep for `get_router`, `invoke`, `llm` in `v1/agents/*.py` returns nothing |
| Budget vocabulary (`AGENT_BUDGET_EXCEEDED`, `max_tool_calls`, `max_input_tokens`, `max_wall`, `BudgetManager`) | absent from production code | grep over `services/ai-api` excluding tests |
| Per-agent failure behavior or human gate declared | absent | no `AgentSpec` type exists |

### Loop stages

| Stage | Present in a production path | Where |
|---|---|---|
| Observe | `PARTIAL` | `parallel_fetch` reads lesson, step, topic, learning style, user step (`content_pipeline.py:72-117`); learner state is not read |
| Interpret | `MISSING` | the api has a rule-based `QuestionUnderstandingService` (used only by `POST /tutor/message`); ai-api has none |
| Plan | `MISSING` | graph order is fixed at build time |
| Act (tools) | `MISSING` | the prompt lists seven tools the model cannot call (`v1/tutor/personalization_prompt.py:127-138`); the live chat prompt lists none |
| Validate | `PARTIAL` | schema check of the response container only (`content_pipeline.py:387-400`) |
| Reflect | `MISSING` | |
| Respond | `IMPLEMENTED` | one LLM call, text stored through the api |

### Agents and tools

| Feature | Status | Source | Notes |
|---|---|---|---|
| Deterministic intent dispatcher | `IMPLEMENTED` | `services/ai-api/v1/agents/router.py:7-31` (5 intents → 5 agent names) | no LLM in routing |
| `POST /ai/v1/agents/run` | `PARTIAL` | `services/ai-api/v1/agents/router_endpoint.py:30-95`; mounted at `main.py:66` | `tutor_agent`, `curriculum_agent`, `assessment_agent` all execute `run_curriculum` (`:20,55-58`), three names for one function. That function fetches the api's policy and memory and stores a short-term memory row (`v1/agents/curriculum_agent.py`); no text is generated. It forwards the caller's bearer token (`:48`) and writes the decision trace through the user-facing route `agents/decision-trace/record`, swallowing failures (`:91-92`) |
| `creator_assistant_agent`, `career_agent` | `PARTIAL` | `v1/agents/creator_assistant_agent.py`, `career_agent.py` | aggregate api GET responses; no generation |
| Web caller of `agents/run` | `BROKEN` | `apps/web/app/lib/api.ts:414-422` posts to `/api/v1/agents/run`, a path served by the Nest API, which has no such route (`services/api/src/v1/agents/decision-trace/decision-trace.controller.ts:7-18` exposes only `agents/decision-trace/{me,record}`; `route-catalog.json` has no entry; nginx has no alias). Callers: `apps/web/app/pages/studio/chat.vue:14`, `apps/web/app/pages/career/index.vue:14` | both pages send `userId: 'me'`, which `bind_acting_user` rejects with 403 even if the request were routed to ai-api (`config/user_auth.py:58-61`) |
| Tool registry | `SCAFFOLDED` | `services/ai-api/v1/tutor/tool_registry.py:8-186`: `PermissionClass` {READ, WRITE, EXTERNAL_ACTION, FINANCIAL} (no ADMIN), `SideEffect`, `RiskLevel`, `ToolMetadata` (id, permission, side effects, timeout), 7 READ tools | methods are `register`, `get`, `all_enabled`, `all` (`:65-80`); no `resolve`, `authorize` or `execute`; no input/output schema, scopes, cost or per-agent allow-list; reachable only through the `v1/tutor/__init__.py` re-export |
| Tool implementations | `UNWIRED` | `services/ai-api/v1/domain/tools.py` (`validate_journal_entry`, `balance_check`, `account_lookup`, `rule_lookup`, `contra_account_resolver`, `concept_explanation`) | callers: `v1/tutor/context_loaders.py`, `tool_registry.py` only |
| `TutorRuntime` | `UNWIRED` | `services/ai-api/v1/tutor/context_loaders.py:30-145` | instantiated at `content_pipeline.py:41`, never called in production (see H-004) |
| Budgets (tokens, wall time, tool calls, credits) | `MISSING` | | The only bounds are the LLM client timeout 60 s and 2 retries (`config/llm_registry.py:16-17`) and Celery `max_retries=3` (`v1/learning/workers.py:64-71`) |
| Human gates | `UNWIRED` | `services/ai-api/v1/optimization/human_approval.py` | in-memory, unreachable |
| Agent session identity | `PARTIAL` | `services/ai-api/config/agent_session.py:9-52` | tenant is derived, not real (H-012) |

### H-005

**Two unrelated tutors.** The api tutor (`POST /tutor/message`, `services/api/src/v1/tutor/tutor.service.ts:58-152`) computes intent, cognitive demand, a strategy, a difficulty target and a scaffold level from mastery and open misconceptions with no LLM, then returns a template sentence. The ai-api tutor (`/ai/v1/learning/generate-material`, `/ai/v1/learning/chat`) calls an LLM with no knowledge of that decision: the strategy, difficulty and scaffold level never enter the ai-api prompt (`content_pipeline.py:357-361` uses a fixed formatting instruction). The requested flow "api authorizes and loads state → signed AI request → AI selects strategy from the policy → LLM → validate → api records" does not exist; the two halves share no field. Web reachability of `/tutor/message` is `UNVERIFIED` (one `'/tutor'` string in `apps/web/app`, not traced to a rendered component).

## Evidence citations

- `services/ai-api/v1/agents/{router,router_endpoint,curriculum_agent,career_agent,creator_assistant_agent}.py`
- `services/ai-api/v1/tutor/{tool_registry,context_loaders,personalization_prompt}.py`
- `services/ai-api/v1/learning/content_pipeline.py:41,72-117,336-425`
- `services/api/src/v1/tutor/tutor.service.ts:58-152`; `services/api/src/v1/agents/decision-trace/decision-trace.controller.ts:7-18`
- `apps/web/app/lib/api.ts:414-422`; `apps/web/app/pages/{studio/chat,career/index}.vue:14`
- Tests: `v1/agents/__tests__` (14), `v1/tutor/__tests__` (11); the tutor tests exercise renderers and `golden_scenarios`, not a live loop

## Verdict

There is no bounded agent runtime: no loop, no tool calls by the model, no budgets, no per-agent specification and no human gate in any reachable path. The pieces of one exist as unreachable scaffolding (`ToolMetadata`, `TutorRuntime`, six domain tools, an approval registry). The one agent endpoint is a data-fetch wrapper whose web callers return 404. Building the target runtime is new work on top of a registry that currently only stores metadata.
