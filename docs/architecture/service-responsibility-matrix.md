# Service Responsibility Matrix

> **Status**: `planned` · **Owner**: `architect` · **Last reviewed**: `2026-09-30`
>
> Who owns what. Single source of truth for service-boundary questions, including the API ↔ AI split and the planned Marketplace + AI Agent Marketplace product surface.

---

## 1. Scope

Per the master prompt §16, this matrix defines:

- Which service **owns** each capability.
- Which service is the **source of truth** for the underlying data.
- Which service is **allowed to mutate** that data.
- The current vs target owner (today vs after migration).

The **Application API** (`api` service, NestJS, port 3002) is the source of truth for all domain data. The **AI Service** (`ai-api` service, FastAPI, port 3003) is the intelligence layer that reads from `api` over HTTP and never touches Postgres directly. The **Marketplace** is a capability surface — not a new service — that lives in `api` with AI assistance for ranking and recommendation.

---

## 2. Capability matrix

| Capability | API | AI | Worker | Frontend | Owner | Source of truth | Allowed mutations |
|---|---|---|---|---|---|---|---|
| Identity (`User`) | ✅ | ❌ | ❌ | ✅ | api | Postgres `User` | api only |
| Authentication (JWT, Google OAuth) | ✅ | ❌ | ❌ | ✅ | api | Postgres `Session` | api only |
| Authorization (RBAC + ownership) | ✅ | ❌ | ❌ | ❌ | api | Postgres `User.role` + per-row checks | api only |
| Curriculum (Topic, SubTopic, Lesson, Step) | ✅ | R | ❌ | ✅ | api | Postgres | api only |
| Material / Resource | ✅ | R (for embedding) | ❌ | ✅ | api | Postgres `Resource` | api only |
| Quiz / Question | ✅ | ❌ | ❌ | ✅ | api | Postgres | api only |
| Quiz Attempt / Answer | ✅ | ❌ | ❌ | ✅ | api | Postgres | api only (evaluator must run) |
| Score / isCorrect | ✅ | ❌ | ❌ | ❌ | api | Postgres | api only |
| Learner Model (mastery, misconception) | ✅ | R (context) | ❌ | ❌ | api | Postgres | api only |
| Memory schema (episodic / semantic / procedural) | ✅ | R + W (via api) | ❌ | ❌ | api | Postgres + Qdrant | api owns schema; ai writes via api |
| Memory embeddings (Qdrant `cervana-memory`) | ❌ | ✅ | ❌ | ❌ | ai-api | Qdrant | ai-api only |
| RAG corpus (curriculum materials) | ✅ ingest | R + W (embed) | ✅ extract_task | ✅ | api metadata + ai embeddings | Postgres metadata + Qdrant vectors | api writes metadata; ai writes vectors |
| RAG retrieval | ❌ | ✅ | ❌ | ❌ | ai-api | Qdrant `cervana-embedding` | ai-api only |
| LLM calls (chat, generation) | ❌ | ✅ | ❌ | ❌ | ai-api | n/a (provider) | ai-api only |
| Adaptive Policy | ✅ | ❌ | ❌ | ❌ | api | Postgres (`PolicyVersion`) | api only |
| AI Tool Orchestration | ❌ | ✅ | ✅ | ❌ | ai-api | LangGraph + Celery | ai-api only |
| Accounting Sandbox (state + journal entries) | ✅ | ❌ | ❌ | ✅ | api | Postgres (`Sandbox*` tables) | api only |
| Accounting Validator (deterministic) | ✅ | ❌ | ❌ | ❌ | api | pure function in api | api only |
| Marketplace (Course + Class + Article) | ✅ | R (recommendation) | ❌ | ✅ | api | Postgres `Product*` | api only |
| Marketplace AI Agent (AgentProduct) | ✅ | R (suggest) | ❌ | ✅ | api | Postgres `AIAgentProduct` | api only |
| Creator Profile | ✅ | ❌ | ❌ | ✅ | api | Postgres `CreatorProfile` | api only |
| Creator Wallet | ✅ | ❌ | ❌ | ✅ | api | Postgres (Decimal) | api only |
| Creator Earnings | ✅ | ❌ | ❌ | ✅ | api | Postgres `CreatorEarning` | api only |
| Payout | ✅ | ❌ | ❌ | ✅ | api | Postgres `Payout` | api only |
| Refund | ✅ | ❌ | ❌ | ✅ | api | Postgres `Refund` | api only |
| Platform Commerce Ledger | ✅ | ❌ | ❌ | ❌ | api | Postgres (double-entry) | api only |
| Sandbox Accounting Ledger | ✅ | ❌ | ❌ | ❌ | api | Postgres (separate schema or namespace) | api only |
| AI Credit Ledger | ✅ | ❌ | ❌ | ❌ | api | Postgres (`AICredit*`) | api only |
| Order | ✅ | ❌ | ❌ | ✅ | api | Postgres `Order` | api only |
| Payment webhook handler | ✅ | ❌ | ❌ | ❌ | api | Stripe webhook + signature verify | api only |
| Notification | ✅ | ❌ | ❌ | ✅ | api | Postgres `Notification` | api only |
| Gamification (XP, souls, stars, streak, leaderboard, achievements) | ✅ | ❌ | ❌ | ✅ | api | Postgres | api only; gamification is event-driven, not request-driven |
| Theme | ✅ | ❌ | ❌ | ✅ | api | Postgres `Theme` | api only |
| Teacher / Tutor application | ✅ | ❌ | ❌ | ✅ | api | Postgres `TeacherApplication` | api only |
| Teacher Override | ✅ | ❌ | ❌ | ❌ | api | Postgres `TeacherOverride` | api only |
| Episode log | ✅ | ❌ | ❌ | ❌ | api | Postgres `Episode` | api only |
| Decision Trace | ✅ | ❌ | ❌ | ❌ | api | Postgres `DecisionTrace` | api only |
| Optimization Run | ✅ | ❌ | ✅ (DSPy worker) | ❌ | api (rows) + ai (computes) | Postgres `OptimizationRun` | api rows; ai writes via api |
| PromptVersion | ✅ | ❌ | ✅ | ❌ | api | Postgres `PromptVersion` | api only |
| PolicyVersion | ✅ | ❌ | ❌ | ❌ | api | Postgres `PolicyVersion` | api only |
| EvaluationDataset (frozen benchmark) | ✅ (read-only for optimizer) | ❌ | ✅ (read-only) | ❌ | api (immutable) | Postgres `EvaluationDataset` | only `api` admin can update; optimizer reads via HTTP |
| xAPI Statement emission | ✅ | R (event source) | ❌ | ❌ | api | LRS-style statement JSON in `Episode` | planned |
| LTI Tool launch | ❌ | ❌ | ❌ | ❌ | deferred | n/a | n/a |
| Observability (OTel traces / metrics) | ✅ | ✅ | ✅ | ✅ | both (each service emits) | OTel collector | both |
| Audit logging | ✅ | ❌ | ❌ | ❌ | api | Postgres `AuditLog` | api only |

Legend: ✅ owns, R = read-only consumer, ❌ = not involved.

---

## 3. Current vs target

| Capability | Current owner | Target owner | Gap |
|---|---|---|---|
| Quiz evaluation | ❌ no service exists | api (deterministic + LLM-judge fallback) | C-004 |
| Ownership checks on chat / user-step | ❌ | api (enforced at controller / repo layer) | C-007 |
| Quiz grading (`isCorrect`, `pointsEarned`) | ❌ never set | api | C-004 |
| Memory write policy | ❌ write-everything-call | api (`MemoryService.should_store`) | H — see [`business-logic-location-audit.md`](../01-audit/business-logic-location-audit.md) |
| Adaptive Policy | ❌ inside LLM prompt | api (deterministic module) | Phase 5 |
| Episode log | ❌ | api | Phase 6 |
| Frozen benchmark | ❌ | api (immutable, `isFrozen = true`) | Phase 7 |
| Agent tool allow-list | ❌ | ai-api (per-tool) | Phase 8 |
| xAPI emission | ❌ | api | Phase 11 |

---

## 4. Detected boundary violations today

These violate the table above and are tracked as findings:

| # | Violation | Evidence | Severity |
|---|---|---|---|
| B-01 | `cervana-api/src/common/lib/embeding.ts` calls LLM provider directly | Source | CRITICAL — must migrate to ai-api |
| B-02 | `ai-api-cervana` calls `/chat/contents/similarity` which does not exist | Source | HIGH — endpoint missing |
| B-03 | `contents.repo.ts:80` queries `content_embeddings` raw SQL | Source | CRITICAL — table does not exist in schema |
| B-04 | `addContentEmbeddingJob` queues to `content` queue with no processor | Source | HIGH |
| B-05 | `tool_memory_upsert` writes to Qdrant from ai-api without write policy | Source | HIGH |
| B-06 | `ActivityDetectorInterceptor` mints streaks on any authenticated ping | Source | HIGH — reward farming |
| B-07 | `resources.controller.ts` allows arbitrary URL upload | Source | HIGH — SSRF + RAG poisoning |

Each is tracked in [`progress-tracker.md`](../progress-tracker.md) §CRITICAL / HIGH findings.

---

## 5. What AI Service is allowed to do

Per the table, AI Service may:

- Read data via HTTP from `api`.
- Write data via HTTP to `api` for AI-derivable artifacts (`Episode`, `DecisionTrace`, `OptimizationRun`, `Memory`).
- Embed documents into Qdrant.
- Run LLM calls.
- Orchestrate LangGraph agents.

AI Service may **not**:

- Connect to Postgres directly.
- Mutate RAW DOMAIN tables (`User`, `Topic`, `Order`, `Wallet`, `Payout`).
- Decide payment, refund, payout, role, or permission changes.
- Bypass authorization guards.

---

## 6. Marketplace product surface

The marketplace is **not** a new service — it lives in `api` with AI assistance. Two product types:

```
Product
├── CourseProduct   (existing Topic / Class / Article)
└── AIAgentProduct   (new)
```

The two are distinguished at the schema level so that `Article` is not mixed with `AgentProduct`. AI may rank, recommend, and explain both product types, but transaction state and pricing live in `api`.

---

## 7. AI Agent Marketplace — separate surface

The AI Agent Marketplace is a **second marketplace experience**, not a duplication of the course marketplace. Capabilities:

```
AgentProduct
├── name
├── description
├── version
├── owner
├── capabilities      (list of tool allow-list IDs)
├── tools              (allowed tools from ai-api registry)
├── permissions        (READ / WRITE / EXTERNAL ACTION / FINANCIAL)
├── supported_inputs
├── supported_outputs
├── models             (allowed model names)
├── pricing            (AI credit cost, top-up price)
├── usage_limits
├── supported_integrations
├── evaluation_status
├── security_status
├── sandbox_status     (must be PASSED before PUBLISHED)
└── publication_status (DRAFT / SANDBOX / VALIDATING / REVIEW / PUBLISHED / SUSPENDED / DEPRECATED / ARCHIVED)
```

Distinct from `CourseProduct` which is human-authored learning content.

---

## 8. Detection patterns

CI should fail if any of these appear in code:

```
# In cervana-api/
grep -rn "openai|anthropic|google" cervana-api/src --include="*.ts"
grep -rn "QdrantClient" cervana-api/src --include="*.ts"

# In ai-api-cervana/
grep -rn "DATABASE_URL" ai-api-cervana/
grep -rn "import.*prisma" ai-api-cervana/
grep -rn "createPool\|pg\b\|createEngine" ai-api-cervana/
```

Any non-empty result is a violation.

---

## 9. Cross-references

- Detailed API endpoint inventory: [`api-inventory.md`](../01-audit/api-inventory.md)
- Microservice boundary audit: [`microservice-boundary-audit.md`](../01-audit/microservice-boundary-audit.md)
- AI agent marketplace design: [`ai-agent-marketplace.md`](../02-architecture/ai-agent-marketplace.md)
- Accounting sandbox design: [`accounting-sandbox.md`](../02-architecture/accounting-sandbox.md)
- Circular economy model: [`circular-economy-model.md`](../02-architecture/circular-economy-model.md)
- Standards alignment: [`../standards/standards-matrix.md`](../standards/standards-matrix.md)