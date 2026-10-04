# AI Agent Audit

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-04`
>
> Inventory and assessment of the AI service's agent runtime, tools, budgets, traces, and episodes. Master prompt §36–§43, §89–§94, §102 set the requirements. Source: `services/ai-api/` at HEAD `a868095`.

## 1. Agent loop (master prompt §36)

The current loop is a single-pass LangGraph (`v1/learning/content_pipeline.py:135-228`):

```text
parallel_fetch
  ↓
prepare_learning_context
  ↓
generate_material
  ↓
END
```

A second LangGraph in `v1/users_steps/generate_user_steps_pipeline.py:372-395` is a 7-node linear graph:

```text
fetch
  ↓
personality_material_builder
  ↓
build_context
  ↓
read_memory
  ↓
semantic_search
  ↓
external_search
  ↓
generate
  ↓
END
```

Both are linear pipelines. There is no:

- `Observe → Interpret → Plan → Act → Validate → Reflect → Respond` loop
- conditional branching
- reflective node
- validation node

The repository's own audit (`docs/audit/agent-architecture-current.md`) confirms this: "The system today is best described as a content-generation orchestration pipeline, not an agentic learning system."

**Finding**:

- AI-AGENT-01: there is no real agent loop. The AI is a deterministic LangGraph with two LLM calls (one for personality, one for path generation). Master prompt §36 requires an Observe-Plan-Act-Validate-Reflect loop. Severity: HIGH.

## 2. Tool registry (master prompt §37)

`utils/tools/` has:

- `memory.py`: `tool_semantic_search`, `tool_memory_upsert`, `tool_memory_read`, `tool_semantic_search_with_fallback`
- `web_search.py`: `tool_web_search`

No `ToolSpec` dataclass with `permissionClass` (READ / WRITE / EXTERNAL_ACTION / FINANCIAL), no `inputSchema`/`outputSchema`, no `requiredScopes`, no `enabled` toggle. Tools are just Python functions called from graph nodes.

**Findings**:

- AI-AGENT-02: no tool registry metadata. The agent endpoint cannot reason about tool permission class. Master prompt §37 requires `ToolSpec`. Severity: HIGH.
- AI-AGENT-03: no `toolClass` allows `FINANCIAL`. The agent cannot currently move money. The application API holds the FINANCIAL boundary. The AI cannot bypass it because it does not have the routes. Severity: PASS for safety; HIGH for the absence of a registry.
- AI-AGENT-04: no agent declares `toolsAllowed`, `permissions`, `dataScope`, `budgets`, `failureBehavior`, `humanGates`. Master prompt §37 / §40 / §89. Severity: HIGH.

## 3. Tool authorization (master prompt §38)

The internal contract exists (`config/service_auth.py`) but the agent endpoint does not enforce `InternalServiceGuard`. The bearer is just a string check (`startswith("Bearer ")` in `router_endpoint.py:25`). The agent endpoint can be hit by any signed-in user.

**Findings**:

- AI-AGENT-05: agent endpoint accepts any user bearer without re-validating the user's role or that the user has access to the requested intent. Severity: HIGH.
- AI-AGENT-06: no per-tool permission check (e.g. a learner should not call `creator_assistant` intent, only teachers). Severity: MEDIUM.

## 4. Web / accounting tool safety (master prompt §40, §41)

`tool_web_search` is unrestricted (see AI-RAG audit). There is no accounting tool, no DRAFT / VALIDATE / POST class. The AI can only `read` content; it cannot post authoritative state. Severity: PASS for the safety guarantee (the API does not give the AI write paths), but the LLM is the only authority for path generation, which is a derived state.

## 5. Tool calls (master prompt §41)

There is no structured tool-call record. The agent endpoint returns the LLM response as a free-form dict, plus a `toolCalls` array that the agent populates from the inner `result.get("toolCalls", [])` field. The value is whatever the agent's run function chose to put there.

The application API's `DecisionTrace` table (api-business-flow-traceability.md) is the destination; the AI populates it via `router_endpoint.py:45-58`. But the AI does not record:

- inputTokens / outputTokens
- cost
- latency
- promptVersion
- modelVersion

**Findings**:

- AI-AGENT-07: the AI contract populates `promptHash` (a sha256 of something) but no token usage or cost. Master prompt §41 requires `inputTokens, outputTokens, cost, latency, response, validation, evaluation status`. Severity: MEDIUM.
- AI-AGENT-08: no `modelVersion` field in the trace. Master prompt §41. Severity: MEDIUM.

## 6. Episode store (master prompt §42)

The application API has the `Episode` and `DecisionTrace` tables. The AI does **not** call any endpoint to create an Episode for each tutor interaction. The agent endpoint only records the DecisionTrace (which is the audit-like record). The richer Episode record (input, decision, output, evaluation, prompt version, policy version, token usage, cost, latency) is not created.

**Findings**:

- AI-AGENT-09: no Episode record per tutor interaction. The application API has the table but the AI doesn't write. Severity: HIGH (master prompt §42 + §117 require episodes for self-improvement).

## 7. Decision trace (master prompt §43)

The `DecisionTrace` table is written by `router_endpoint.py:45-58`. The trace contains `agentName, agentScope, userId, promptHash, toolCalls, deterministicOutputs`. It does **not** contain:

- `policyVersion`
- `learnerState` snapshot
- `availableActions`
- `selectedAction`
- `reasonCodes`

**Findings**:

- AI-AGENT-10: decision trace lacks `policyVersion` and `reasonCodes`. The LLM chose the path; the API has no record of why. Severity: MEDIUM (master prompt §43).

## 8. Max agent budgets (master prompt §90)

None. The LangGraph runs to completion. The LLM call has no client-side timeout (`build_chat_model` in `config/providers.py:115-136` does not pass `timeout` to `ChatOpenAI`). Tavily has `timeout=10`. There's no max iterations, no max tool calls, no max cost.

**Findings**:

- AI-AGENT-11: no `timeout` on the LLM call. A stalled LLM can hang the LangGraph indefinitely. Severity: HIGH.
- AI-AGENT-12: no `max_iterations`, no `max_tool_calls`, no `max_cost`. Master prompt §90. Severity: MEDIUM.

## 9. Output validation (master prompt §87)

The agent endpoint returns `result` verbatim. There is no:

- `schema validation` (no Pydantic response model)
- `domain validation` (no accounting rules)
- `policy validation` (no adaptive policy check)
- `grounding validation` (no citation enforcement)
- `safety validation` (no PII / prompt-injection output filter)

The application API has no place to enforce these because the AI doesn't send a typed response.

**Findings**:

- AI-AGENT-13: no Pydantic response schema on the agent endpoint. The application API can't validate the response. Severity: HIGH.
- AI-AGENT-14: the LLM output is written to the chat log verbatim (PATCH `text=...`) and to memory (the whole content as one entry). The user sees raw LLM prose, no domain structure. Severity: MEDIUM.

## 10. Output schema (master prompt §22)

None of the agents return a typed structure. The `tutor` agent returns a string from `get_propmpt_material` that goes into the chat log as a single text update. The `creator_assistant` returns whatever dict `run_creator_assistant` produces. The `career` agent returns a dict.

**Findings**:

- AI-AGENT-15: no Pydantic `TutorResponse` / `CreatorResponse` / `CareerResponse` model. The router endpoint's `AgentRequest` is typed but the response is not. Severity: HIGH.

## 11. Reasoning storage (master prompt §23)

The `DecisionTrace` stores `toolCalls` and `deterministicOutputs`, not chain-of-thought. Master prompt §23 says store structured decision metadata, not unrestricted hidden reasoning. The current code is correct in this respect.

## 12. Internal reasoning (master prompt §102)

The `agentScope` (passed as `req.intent.upper()`) is the routing decision. The `deterministicOutputs` are the agent's structured result. There is no chain-of-thought stored. Master prompt §102 / §41 satisfied.

## 13. Failure recovery (master prompt §85)

The LangGraph has no error handler. A node failure throws and the caller sees the exception. There is no fallback path. The Tavily call has `try/except` that returns `""` (safe fallback); the memory tool has `try/except` that returns `[]`. The personality builder has fallback values. But the LLM call has no try/except.

**Findings**:

- AI-AGENT-16: LLM call has no error handler. A 500 from the LLM provider becomes a 500 to the browser. Master prompt §85 / §86. Severity: HIGH.

## 14. Tool failure boundary (master prompt §86)

The memory tool and Tavily silently swallow errors and return `[]` or `""`. The LLM call has no boundary. The agent's final LLM call has no try/except.

**Finding**: AI-AGENT-17: the final LLM call's failure is not contained. Master prompt §86: "cannot fabricate tool result" — the AI cannot fabricate, but the entire response fails. Severity: MEDIUM.

## 15. Cross-service contract (master prompt §102)

`router_endpoint.py:45-58` calls `POST /v1/agents/decision-trace/record` on the application API with the user bearer token forwarded. The application API is in the loop. The internal signed contract is not in the loop.

`ADR-007` (api-business-logic-audit.md S-3) records that the migration to signed internal contract is in progress; only the resources router is migrated. The agents endpoint still forwards the user token. Severity: documented as S-3.

## 16. Tests

| Path | Status |
|---|---|
| `v1/agents/__tests__/test_router_dispatch.py` | green (no LLM in dispatch source) |
| `v1/agents/__tests__/test_curriculum_agent.py` | 2 fail (pre-existing; `httpx.AsyncMock` signature mismatch with the new code) |

The router dispatch test is the only green test. The agent tests are broken at the source level. Severity: MEDIUM.

## 17. Summary scorecard (AI-AGENT)

| Area | Status |
|---|---|
| Real agent loop (Observe-Plan-Act-Validate-Reflect) | `MISSING` (linear LangGraph) |
| Tool registry (ToolSpec, permissionClass) | `MISSING` |
| Tool authorization (FINANCIAL/EXTERNAL guards) | `PARTIAL` (no FINANCIAL surface; agent endpoint has only bearer check) |
| Tool declarations per agent (toolsAllowed, budgets) | `MISSING` |
| Internal signed contract on agent endpoint | `MISSING` (forwards user token; S-3) |
| Max budgets (iterations, cost, time) | `MISSING` |
| LLM call timeout | `MISSING` |
| Output Pydantic schema | `MISSING` |
| Output validation (schema, domain, grounding) | `MISSING` |
| Decision trace (reasonCodes, policyVersion) | `PARTIAL` |
| Episode record per interaction | `MISSING` (table exists; AI doesn't write) |
| Tool failure containment | `PARTIAL` (memory + Tavily swallow; LLM doesn't) |
| Output fence in prompt | `MISSING` for LLM and user input |
| Tests | 1 green, 2 fail (pre-existing) |

## 18. Required next-step

For Phase 6 (Personalized Tutor) and Phase 7 (Gamification), the AI needs to:

1. Add `ToolSpec` dataclass with `permissionClass`, `inputSchema`, `outputSchema`, `sideEffects`, `requiredScopes`, `cost`, `riskLevel`, `enabled`.
2. Add `toolsAllowed` and `budgets` to the `AgentRequest`.
3. Apply `build_chat_model(..., timeout=30)` to the LLM factory.
4. Add a Pydantic `TutorResponse` schema with `response`, `mode`, `strategy`, `citations`, `nextAction`, `learningSignals`, `memoryCandidates`, `traceId`, `episodeId`.
5. Wrap LLM output and user input in segmentation fences.
6. Have the agent endpoint call the application API to write an `Episode` row per interaction.
7. Add `reasonCodes` to the `DecisionTrace` payload.
8. Fix the 2 broken `test_curriculum_agent.py` tests.

These are scoped to Phase 6 per master prompt §112.

## 19. Cross-references

- `ai-foundation-audit.md`
- `ai-domain-audit.md`
- `ai-personalization-audit.md`
- `ai-memory-audit.md`
- `ai-rag-audit.md`
- `ai-evaluation-audit.md`
- `ai-self-improvement-audit.md`
- `api-business-flow-traceability.md` BF-008, BF-013
- `api-business-logic-audit.md` S-3 (signed contract)
- `docs/audit/agent-architecture-current.md` (existing agent audit, confirms linear pipelines)
