# AI Agent Marketplace

> **Status**: `planned` · **Owner**: `product-architect` · **Last reviewed**: `2026-09-30`
>
> A second marketplace surface alongside the Course Marketplace, where creators publish AI agents (tutors, copilots, simulators). Every published agent must pass sandbox validation, declare its tool/permission scope, and carry an evaluation status.

---

## 1. Why a second marketplace

The platform supports **two product types** with fundamentally different validation models:

| Product type | Author | Validation | Pricing |
|---|---|---|---|
| `CourseProduct` | human | Tutor review + learner outcomes | one-time or subscription |
| `AIAgentProduct` | creator (human) + AI | sandbox validation + evaluation harness + safety review | per-use AI credits |

Mixing them in one table forces a discriminator that hides the difference. Each product type gets its own schema, but both share the marketplace's commerce pipeline (Order, Payment, Wallet).

---

## 2. AIAgentProduct schema

```prisma
model AIAgentProduct {
  id                    String   @id @default(uuid())
  ownerId               String
  owner                 User     @relation(fields: [ownerId], references: [id])
  name                  String
  slug                  String   @unique
  description           String   @db.Text
  version               String

  // Capabilities and tools
  capabilities          Json      // list of strings, e.g. ["explain", "quiz", "summarize"]
  toolsAllowed          Json      // list of tool IDs from the ai-api registry
  permissions           Json      // list of enum values: READ | WRITE | EXTERNAL_ACTION | FINANCIAL
  dataScope             Json      // scopes allowed: ["learner_self", "course", "public"]

  // I/O contract
  supportedInputs       Json      // schema descriptors
  supportedOutputs      Json      // schema descriptors
  modelsAllowed         Json      // list of allowed model names from env

  // Pricing
  pricingModel           PricingModel                // PER_CALL / PER_1K_TOKENS / PER_MONTH
  pricePerUnit          Decimal  @db.Decimal(10, 6)
  currency              String   @default("IDR")
  aiCreditCost          Int                          // optional AI-credit cost per use

  // Limits
  usageLimits           Json                        // { perUserPerDay, perOrgPerDay, burst, etc. }

  // Integrations
  supportedIntegrations Json

  // Status (master prompt §11)
  evaluationStatus      AgentStatus @default(DRAFT)
  securityStatus        AgentStatus @default(DRAFT)
  sandboxStatus         AgentStatus @default(DRAFT)
  publicationStatus     AgentStatus @default(DRAFT)

  // Documentation
  documentationUrl      String?
  knownFailureCases     Json      // list of strings
  agentCard             Json      // machine-readable agent card

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  @@index([ownerId])
  @@index([publicationStatus])
}
```

### 2.1 AgentStatus enum

```prisma
enum AgentStatus {
  DRAFT
  SANDBOX
  VALIDATING
  REVIEW
  PUBLISHED
  SUSPENDED
  DEPRECATED
  ARCHIVED
}
```

Every status has its own transition rule:

| From | To | Trigger | Required |
|---|---|---|---|
| DRAFT | SANDBOX | creator submits | none |
| SANDBOX | DRAFT | sandbox test fails | failure report |
| SANDBOX | VALIDATING | sandbox test passes | sandbox result JSON |
| VALIDATING | REVIEW | LLM-as-judge passes threshold | evaluation metrics JSON |
| REVIEW | DRAFT | human reviewer rejects | rejection notes |
| REVIEW | PUBLISHED | human reviewer approves | approval id |
| PUBLISHED | SUSPENDED | incident or revocation | incident id |
| SUSPENDED | PUBLISHED | human un-suspends | approval id |
| PUBLISHED | DEPRECATED | creator marks deprecated | deprecation note |
| any | ARCHIVED | 90 days inactive or explicit archive | archival note |

The transition `REVIEW → PUBLISHED` requires a human approval id. **No agent publishes automatically.**

---

## 3. Agent Card

Per master prompt §114, each agent publishes a machine-readable agent card. Stored in `AIAgentProduct.agentCard` JSON.

```json
{
  "name": "Accounting Journal Entry Tutor",
  "version": "1.2.0",
  "owner": "creator-uuid",
  "purpose": "Help learners practice double-entry journal entries.",
  "capabilities": ["explain", "hint", "review"],
  "tools": ["sandbox_lookup_account", "sandbox_validate_entry"],
  "permissions": ["READ"],
  "dataScope": ["learner_self", "course"],
  "models": ["gpt-4o-mini"],
  "limitations": "Cannot post journal entries; only DRAFT.",
  "knownFailureCases": [
    "Confuses contra accounts with regular accounts",
    "Suggests unbalanced entries on multi-currency scenarios"
  ],
  "safetyControls": [
    "All journal entries validated by AccountingEngineService before persist",
    "Cannot call POST /v1/accounting/sandbox/:id/entries/post",
    "Cannot mutate Wallet, Payout, Order"
  ],
  "evaluationMetrics": {
    "correctness": 0.86,
    "grounding": 0.81,
    "pedagogy": 0.79,
    "hallucination": 0.04
  },
  "sandboxPassedAt": "2026-09-30T12:00:00Z",
  "humanApprovedBy": "owner-uuid",
  "humanApprovedAt": "2026-09-30T13:00:00Z"
}
```

---

## 4. Tool permissions

Per master prompt §11, every tool has an explicit permission class:

| Class | Examples | Default policy |
|---|---|---|
| READ | RAG retrieval, ledger lookup | allowed by default |
| WRITE | journal entry DRAFT | allowed |
| WRITE | lesson progress write | allowed (scoped to learner) |
| EXTERNAL ACTION | web search, send notification | requires tool allow-list entry |
| FINANCIAL | refund, payout, wallet mutation | requires separate FINANCIAL approval + audit log |

Production agents must declare `toolsAllowed` (list of tool IDs) and `permissions` (list of permission classes). The application service refuses to invoke a tool that is not in the allow-list.

---

## 5. Sandbox

Every commercial AI agent must pass a sandbox validation before publication.

```
Agent
   ↓
Sandbox Runtime
   ↓
Mock Tools (read-only stubs)
   ↓
Synthetic Data (fixtures)
   ↓
Evaluation Harness (frozen benchmark + LLM-as-judge)
   ↓
Security Tests (prompt injection, RAG poisoning, memory poisoning)
   ↓
Policy Tests (refuses to execute unauthorized tools)
   ↓
Cost Tests
   ↓
Human Review
   ↓
Publish
```

The sandbox must not have access to:

- Production Postgres.
- Production Qdrant.
- Production Redis (except via dedicated read-only endpoints).
- Production Stripe / Midtrans.
- Production learner private data.
- Production administrative credentials.

The sandbox runs on a separate Docker network with its own `sandbox_*` Postgres schema.

---

## 6. Sandbox modes

Per master prompt §71:

| Mode | Use | AI allowed? | Output |
|---|---|---|---|
| LEARN | Learner practice | yes (high guidance) | feedback |
| PRACTICE | Learner practice | yes (moderate guidance) | feedback + score |
| CHALLENGE | Learner practice | yes (low guidance) | score only |
| EXAM | Assessment | yes (minimal) | score |
| AGENT_TEST | Creator/Admin | N/A (we test the agent, not via AI) | correctness, tool usage, policy compliance |

---

## 7. Agent test report

Output of `AGENT_TEST` mode:

```json
{
  "agentId": "...",
  "scenarioSetId": "...",
  "report": {
    "correctness": 0.86,
    "accountingValidity": 1.00,
    "toolCorrectness": 0.94,
    "grounding": 0.81,
    "policyCompliance": 1.00,
    "safety": 1.00,
    "p50LatencyMs": 320,
    "p95LatencyMs": 1180,
    "costPerRun": 0.0023,
    "toolCalls": [...],
    "violations": [],
    "failureReasons": []
  }
}
```

Reports persisted to `AgentTestReport` table.

---

## 8. Discovery UI

The marketplace must distinguish two product surfaces:

```
Marketplace
├── Courses         (human-authored)
│   └── Article, Class, Practice
└── Agents          (AI products)
    └── AgentCard, SandboxStatus, EvaluationScore
```

Do not confuse `course price` with `agent pricing`.

Agent detail page shows:

- Agent card.
- Capabilities + permissions + data scope.
- Sandbox pass history.
- Latest evaluation metrics.
- Safety status.
- Documentation link.
- Pricing.
- Usage limits.

---

## 9. Lifecycle

```
creator builds agent
   ↓
saves as DRAFT
   ↓
submits to sandbox
   ↓
sandbox tests run (correctness, accounting validity, tools, policy, cost)
   ↓
   pass → validationStatus = VALIDATING
   fail → validationStatus = DRAFT + failure report
   ↓
LLM-as-judge evaluates pedagogical quality
   ↓
   pass → reviewStatus = REVIEW
   ↓
human reviewer approves → publicationStatus = PUBLISHED
   ↓
agent appears in marketplace
```

---

## 10. Cross-references

- Service responsibility: [`service-responsibility-matrix.md`](./service-responsibility-matrix.md) §6, §7
- Circular economy model: [`circular-economy-model.md`](./circular-economy-model.md) §4.2
- Accounting sandbox: [`accounting-sandbox.md`](./accounting-sandbox.md)
- Standards mapping: [`../standards/standards-matrix.md`](../standards/standards-matrix.md)
- Master prompt §11, §43, §44, §69, §71, §72, §114