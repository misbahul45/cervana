# Agent Safety

> **Status**: `planned` · **Owner**: `security` · **Last reviewed**: `2026-09-30`
>
> Explicit safety, permission, and audit contract for every AI agent in ReduCera. Production tools are classified; financial and external actions require deterministic policy validation.

---

## 1. Purpose

An AI agent that can call arbitrary tools is a **production risk**. The ReduCera platform treats every AI agent as a least-privileged actor with:

- Declared tool allow-list.
- Declared permission scope.
- Tenant scope.
- Execution budget (token, time, count).
- Audit trail.

This document codifies the policy. It is enforced by `api` (the source-of-truth service), not by `ai-api`. AI proposals are **validated** by the application; the application is the final authority for sensitive actions.

---

## 2. Permission classes

Every tool, every write, and every external action falls into exactly one of:

| Class | Meaning | Examples | Default policy |
|---|---|---|---|
| `READ` | Read data within tenant scope | RAG retrieve, ledger lookup, lesson read | Allowed |
| `WRITE` | Mutate domain entities within tenant scope | lesson progress write, journal entry draft | Allowed (scoped) |
| `WRITE` | Mutate domain entities cross-tenant | – | Forbidden |
| `EXTERNAL_ACTION` | Network call to non-platform service | web search, send notification, LLM tool call | Requires tool allow-list + audit |
| `FINANCIAL` | Real money or wallet mutation | refund, payout, wallet adjustment | **Forbidden for AI**. Requires human approval via application service |
| `ADMIN` | Privilege escalation | role change, permission grant | **Forbidden for AI**. Requires human approval |

---

## 3. Tool security contract

Every tool in the `ai-api` registry declares:

```python
@dataclass
class ToolSpec:
    tool_id: str                # unique within registry
    purpose: str
    permission_class: PermissionClass
    input_schema: dict          # JSON schema
    output_schema: dict         # JSON schema
    side_effects: str           # free text
    allowed_agents: list[str]   # agent IDs that may invoke this tool (empty = none)
    tenant_scope: TenantScope   # LEARNER_SELF | COURSE | PUBLIC
    timeout_seconds: int
    retry_policy: RetryPolicy
    idempotency: bool
    rate_limit_per_minute: int
    audit_required: bool        # every invocation must be logged in DecisionTrace
```

### 3.1 Tool registry storage

```prisma
model ToolRegistry {
  id              String   @id @default(uuid())
  toolId          String   @unique
  purpose         String
  permissionClass String            // READ | WRITE | EXTERNAL_ACTION | FINANCIAL | ADMIN
  inputSchema     Json
  outputSchema    Json
  sideEffects     String
  tenantScope     String            // LEARNER_SELF | COURSE | PUBLIC
  timeoutSeconds  Int      @default(30)
  retryPolicy     String   @default("none")
  idempotent       Boolean  @default(false)
  rateLimit        Int      @default(60)
  auditRequired    Boolean  @default(true)
  deprecatedAt     DateTime?
}
```

The tool registry is **admin-managed**. Agents cannot register tools. AI proposals for new tools are stored as `AgentToolProposal` and reviewed by a human.

---

## 4. Agent tool allow-list

Each `AIAgentProduct.toolsAllowed` lists tool IDs from the registry. The `ai-api` runtime refuses to invoke a tool that:

- Is not in the agent's allow-list.
- Has `permission_class` higher than what the agent declares.
- Has `tenant_scope` broader than the agent's `dataScope`.
- Is deprecated (`deprecatedAt` set).

If the agent requests a tool call outside its allow-list, the runtime:

1. Returns a deterministic error `TOOL_NOT_ALLOWED` with reason.
2. Logs the attempt in `DecisionTrace`.
3. Does not retry the LLM with the same tool call (would loop forever).

---

## 5. AI agent runtime contract

When an agent runs:

```
AI agent request
   ↓
POST /v1/agent/run
{
  "agentId": "...",
  "userId": "...",
  "tenantScope": "...",
  "sessionId": "...",
  "input": {...}
}
   ↓
application server validates:
   - agent exists and is PUBLISHED
   - userId has access to agent
   - tenantScope ⊆ agent.dataScope
   - agent is not SUSPENDED or DEPRECATED
   ↓
spawn agent execution with:
   - agent definition (tools, permissions, model)
   - userId (cannot be overridden by agent)
   - tenantScope (cannot be widened by agent)
   - execution budget (tokens, time, count)
   ↓
agent emits tool_calls (proposed)
   ↓
application validates each tool_call against ToolRegistry + AgentAllowList
   ↓
approved tool_calls executed
   ↓
all tool_calls + results logged in DecisionTrace
   ↓
response returned to user
```

---

## 6. Forbidden agent actions

Per master prompt §11, an AI agent must NOT:

- Decide refund amount.
- Decide creator payout amount.
- Mutate wallet.
- Mutate platform fees.
- Change roles or permissions.
- Modify the frozen benchmark.
- Deploy a new prompt version to ACTIVE.
- Move real money.

These are **deterministic actions** owned by application services.

If the agent's output contains such an action as a recommendation, it is logged as a "human-required" item in the `DecisionTrace`. The application surfaces it to the appropriate human reviewer.

---

## 7. Budget enforcement

Each agent run has:

| Budget | Default | Configurable per agent |
|---|---|---|
| Token input | 100k | yes |
| Token output | 50k | yes |
| Total tokens | 150k | yes |
| Wall-clock time | 60s | yes |
| Tool calls | 50 | yes |
| Cost (USD) | $1.00 | yes |

If any budget is exceeded, the runtime aborts the run, persists the partial result, and returns a structured error.

---

## 8. Audit trail

Every agent invocation produces a `DecisionTrace` row with:

```
traceId, learnerId, sessionId, agentId, agentVersion, promptVersion, policyVersion, model,
strategy, retrievedMemoryIds, retrievedDocumentIds, toolCalls[], toolResults[],
latencyMs, tokensIn, tokensOut, costUsd, evaluation, timestamp
```

Tool calls include the tool ID, input, output, permission class, and audit outcome. No internal chain-of-thought is stored (per master prompt §52).

---

## 9. Test scenarios for agent safety

These are required test cases for every agent before publication (master prompt §57):

| Scenario | Expected |
|---|---|
| Tool not in allow-list | Refused with deterministic error |
| Tool with FINANCIAL class | Refused unless agent declares it AND human approves |
| Output exceeds tenant scope | Refused |
| Loop (agent calls same tool repeatedly) | Aborted after budget |
| Prompt injection in retrieved content | Agent output validated against input segments |
| Cross-user data request | Refused |
| Wallet mutation attempt | Refused + logged as incident |
| Payout mutation attempt | Refused + logged as incident |
| Refund mutation attempt | Refused + logged as incident |
| Production credential disclosure attempt | Output filter redacts |

---

## 10. Incident handling

When the system detects an agent attempting a forbidden action:

1. The attempt is logged in `DecisionTrace` with severity `CRITICAL`.
2. The agent's run is aborted.
3. An `AgentIncident` row is created with:
   - `agentId`
   - `userId`
   - `incidentType` (e.g., `UNAUTHORIZED_TOOL_CALL`)
   - `toolId` or `proposedAction`
   - `severity`
   - `timestamp`
4. Admin endpoint `POST /admin/agents/:id/suspend` can mark the agent `SUSPENDED`.
5. Notification to admin + creator.

---

## 11. Cross-references

- Service responsibility: [`service-responsibility-matrix.md`](./service-responsibility-matrix.md)
- AI agent marketplace: [`ai-agent-marketplace.md`](./ai-agent-marketplace.md)
- Accounting sandbox: [`accounting-sandbox.md`](./accounting-sandbox.md)
- Security audit: [`../01-audit/security-audit.md`](../01-audit/security-audit.md)
- Standards mapping: [`../standards/standards-matrix.md`](../standards/standards-matrix.md)
- Master prompt §11, §44, §58