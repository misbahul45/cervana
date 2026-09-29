# Circular Economy Model

> **Status**: `planned` · **Owner**: `product-architect` · **Last reviewed**: `2026-09-30`
>
> How Cervana is structured as a circular learning economy, with explicit value flows, KPIs, and the boundaries between economic, knowledge, and AI-credit circularity.

---

## 1. North star

Cervana is not only an AI tutor. It is a **learning marketplace + creator economy + AI agent infrastructure** organized as a **circular learning economy**:

```
                     LEARNER
                        │
                        ▼
                LEARNING / PRACTICE
                        │
                        ▼
                  EXPERTISE
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
        CREATE ARTICLE       CREATE CLASS
              │                   │
              └─────────┬─────────┘
                        ▼
                     PUBLISH
                        │
                        ▼
                   MARKETPLACE
                        │
                        ▼
                  LEARNERS USE
                        │
                        ▼
                     REVENUE
                        │
                        ▼
                CREATOR WALLET
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
           PAYOUT             REINVEST
                                │
                  ┌─────────────┴─────────────┐
                  ▼                            ▼
             BUY CLASSES                  BUY AI CREDITS
                  │                            │
                  └─────────────┬──────────────┘
                                ▼
                              LEARN
                                │
                                └────────────► CREATE (↺)
```

The AI engine sits **on top** of this loop. AI may **recommend**; deterministic services **decide**; humans **approve** sensitive actions.

---

## 2. Three kinds of circularity

Per master prompt §3:

### 2.1 Economic circularity

```
Purchase
   ↓
Payment
   ↓
Settlement
   ↓
Platform Fee
   ↓
Creator Share
   ↓
Creator Wallet
   ↓
Reinvestment (in AI credits or other courses)
   ↓
Re-purchase
```

### 2.2 Knowledge circularity

```
Learner consumes content
   ↓
Learner builds expertise
   ↓
Learner creates derivative content (article / class / sandbox scenario)
   ↓
New learner consumes that
   ↓
Derivative content references original
   ↓
Attribution loop
```

### 2.3 AI-credit circularity

```
Learner earns AI credits (free class attendance, quiz streaks)
   ↓
Learner uses AI credits (AI tutor, AI explanations, sandbox hints)
   ↓
AI assistance improves learning outcomes
   ↓
Learner earns more AI credits via better performance
   ↓
(↺)
```

### 2.4 Creator circularity (sub-loop)

```
Learner
   ↓
builds expertise
   ↓
becomes Creator
   ↓
publishes Course / Class / Article / AI Agent
   ↓
earns revenue
   ↓
reinvests in own learning + AI credits
   ↓
improves content based on learner analytics
   ↓
(↺)
```

### 2.5 Digital-resource circularity

A `Lesson` may be transformed into:

- `Article`
- `Quiz`
- `SandboxScenario`
- `AI Agent knowledge source`

with provenance tracked. The original resource is not duplicated — it is referenced.

### 2.6 What is NOT circular

- **Physical-material circularity**: Cervana is a digital learning platform. Environmental-impact metrics are out of scope unless a separate product lifecycle boundary is introduced (it is not).
- **Engagement-metric circularity**: page views, click counts, notification opens are **not** circularity evidence. They are anti-patterns.

---

## 3. Value flows

The five flows the system must instrument:

### 3.1 Knowledge flow

- Author → Resource (lesson, article)
- Resource → Embedding (Qdrant)
- Embedding → Retrieval → LLM prompt
- LLM response → Content
- Content → Chat history → Memory
- Memory → Retrieval → next LLM prompt

### 3.2 Money flow

- Buyer → Stripe / Midtrans → `Order.PAID`
- `Order.PAID` → Settlement
- Settlement → `CreatorEarning` (creator share)
- Settlement → `PlatformFee`
- `CreatorEarning` → `Wallet`
- `Wallet` → `Payout`

### 3.3 AI-credit flow

- Source (free class attendance, quiz streak, top-up purchase) → `AICreditEntry CREDIT`
- Usage (LLM call, sandbox hint, AI tutor) → `AICreditEntry DEBIT`
- Adjustment → `AICreditEntry EXPIRE` or `ADJUSTMENT`

### 3.4 Sandbox accounting flow

- Scenario → `SandboxAccount` chart
- `SandboxTransaction` → deterministic debit/credit validation
- `JournalEntry` → `JournalLine[]` (debit + credit, must balance)
- Post → `LedgerEntry` (per account)
- `TrialBalance` computed deterministically
- `AdjustingEntry` → re-compute `TrialBalance`
- `FinancialStatement` (Income Statement, Balance Sheet) derived from `TrialBalance`

### 3.5 Creator-economy flow

- `CreatorProfile` → publishes `CourseProduct` / `AIAgentProduct`
- `Order.PAID` → `CreatorEarning` (per product, per creator)
- `CreatorEarning` → `Wallet`
- `Wallet` → `Payout` (after `PayoutRequest`)
- `Wallet` → `AICreditPurchase` (reinvestment)
- Reinvestment → creates new `LearningEvent` or new content

---

## 4. Two-product surface

Cervana exposes two product surfaces on the marketplace. They share the commerce pipeline but have distinct schemas.

### 4.1 Course product (human-authored)

```
CourseProduct
├── title
├── description
├── prerequisites
├── syllabus
├── creator
├── topics[]
├── difficulty (0..1)
├── duration_minutes
├── price
├── access_type (FREE / PAID)
├── format (ARTICLE / CLASS / RECORDED / LIVE)
├── sandbox_enabled (boolean)
├── ai_assistant_enabled (boolean)
├── certification_offered (boolean)
├── quality_signals (composite metric)
├── learner_outcomes_signals (completion rate, mastery gain)
└── publication_status
```

### 4.2 AI agent product

```
AIAgentProduct
├── name
├── description
├── version
├── owner (creator_id)
├── capabilities[]
├── tools[]
├── permissions (READ / WRITE / EXTERNAL_ACTION / FINANCIAL)
├── data_scope
├── supported_inputs
├── supported_outputs
├── models_allowed[]
├── pricing (per-call, per-1k-tokens, or per-month)
├── usage_limits
├── supported_integrations[]
├── evaluation_status (DRAFT / SANDBOX / VALIDATED / REVIEW / PUBLISHED / SUSPENDED / DEPRECATED / ARCHIVED)
├── security_status
├── sandbox_status
├── known_failure_cases[]
└── documentation_url
```

Distinct schema. Do not collapse into one `Product` table with a discriminator, because the validation, sandbox, and pricing models differ substantially.

---

## 5. Circularity KPI model

Per master prompt §101, the platform exposes these component metrics. No single opaque "circularity score".

### 5.1 Learning circularity

| KPI | Definition | Source |
|---|---|---|
| Lesson reuse rate | % of enrolled learners who completed a lesson that was created ≥ 6 months ago | `LessonProgress` |
| Course update rate | % of published courses updated within last 90 days | `Resource` |
| Quiz reuse | % of quiz questions used in ≥ 3 lessons | `Quiz` |
| Knowledge reuse | % of resources referenced from ≥ 2 distinct topics | Resource reference table |

### 5.2 Creator circularity

| KPI | Definition |
|---|---|
| Learner → Creator conversion rate | % of active learners who published at least one resource |
| Creator retention | % of creators with at least one published product still active after 12 months |
| Creator reinvestment rate | % of creator wallet withdrawals that flow back into the platform within 30 days |
| Content remix rate | % of new resources that reference an existing resource |

### 5.3 AI-credit circularity

| KPI | Definition |
|---|---|
| AI credit earn rate | Credits earned per active learner per week |
| AI credit spend rate | Credits spent per active learner per week |
| Earn:spend ratio | Should be ≥ 1 to ensure circularity |
| Credit expiration rate | % of issued credits that expire unspent |

### 5.4 Marketplace circularity

| KPI | Definition |
|---|---|
| Free → paid conversion | % of free-class learners who later purchase a paid product |
| Paid → creator conversion | % of paid-product learners who become creators |
| Knowledge reuse rate | same as 5.1 |
| Course completion | % of paid-course purchases that complete ≥ 80% of lessons |

### 5.5 Sandbox circularity

| KPI | Definition |
|---|---|
| Sandbox reuse rate | % of scenarios completed by ≥ 1 learner per creator |
| Sandbox correctness | % of learner journal entries that balance debit and credit |
| Sandbox mastery lift | Pre-vs-post quiz correctness on sandbox-related topics |

### 5.6 System health (not circularity, but adjacent)

| KPI | Source |
|---|---|
| Daily active learners | – |
| Course completion rate | – |
| Streak continuity (event-driven) | – |
| RAG retrieval precision | – |

---

## 6. How to compute circularity safely

Each KPI has a documented:

- Formula (the exact arithmetic).
- Data sources (which tables or events).
- Window (7d, 30d, 90d, 12mo).
- Privacy scope (per-user vs per-tenant vs per-course).
- Limitations (what it does NOT measure).

If a single aggregate "circularity score" is ever introduced:

- Document the formula in code as a versioned function.
- Document weights explicitly.
- Document uncertainty (confidence interval).
- Never replace component metrics with the aggregate.

---

## 7. Forbidden metrics

These are **explicitly excluded** from circularity evidence because they incentivize manipulation:

- Page views.
- Click counts.
- Notification open rate.
- Time-on-app (without engagement measurement).
- Number of messages sent.

These measure attention, not learning. Attention metrics can be circular (attention loops the system back to the user) but that is **anti-circularity** — it traps value in engagement rather than circulating it.

---

## 8. Circular business flows (anchor)

The four anchor flows (already documented in [`business/README.md`](../../business/README.md)):

| ID | Flow | Role |
|---|---|---|
| BF-001 | User Learns Accounting Concept | Core learning |
| BF-002 | User Purchases Course | Money in |
| BF-003 | Creator Receives Revenue Share | Money out (creator side) |
| BF-004 | Learner Earns and Spends AI Credits | In-app credit circularity |

Extended flows (master prompt §100):

| ID | Flow |
|---|---|
| BF-005 | Creator Publishes Article |
| BF-006 | Creator Hosts Free Class |
| BF-007 | Creator Hosts Paid Class |
| BF-008 | AI Recommends Next Activity |
| BF-009 | Certification Practice |
| BF-010 | Learning-to-Creator Conversion |
| BF-011 | Creator Creates AI Agent |
| BF-012 | AI Agent Marketplace Purchase |
| BF-013 | AI Agent Sandbox Validation |
| BF-014 | AI Agent Publication |
| BF-015 | AI Credit Earn |
| BF-016 | AI Credit Spend |
| BF-017 | Creator Requests Payout |
| BF-018 | Refund |
| BF-019 | Accounting Sandbox Practice |
| BF-020 | Learner Publishes Knowledge |
| BF-021 | Knowledge Reuse / Remix |
| BF-022 | Learner Reinvests Earnings |
| BF-023 | Agent Self-Improvement |
| BF-024 | Human Approval of AI Version |
| BF-025 | Circularity Measurement |

Each will be authored as a separate BF doc. Today's planning is at the index level.

---

## 9. Anti-patterns to reject

The circular-economy framing rejects these:

| Anti-pattern | Why rejected |
|---|---|
| Maximize session duration | Reward farming; not learning |
| Maximize click-through to upsell | Commercial bias; breaks learning goal |
| Reward any authenticated ping | Streak farming |
| Store every conversation in memory | Memory pollution |
| Derive money from LLM output | Unauditable commerce |
| Let LLM decide refund amount | Unauditable finance |
| Claim circularity from page views | Vanity metric |
| Single "circularity score" without methodology | Opaque aggregate |

---

## 10. Cross-references

- Standards mapping: [`../standards/standards-matrix.md`](../../standards/standards-matrix.md)
- Service responsibility: [`service-responsibility-matrix.md`](./service-responsibility-matrix.md)
- Accounting sandbox: [`accounting-sandbox.md`](./accounting-sandbox.md)
- AI agent marketplace: [`ai-agent-marketplace.md`](./ai-agent-marketplace.md)
- Business flows: [`../../business/README.md`](../../business/README.md)
- Target architecture: [`target-state.md`](./target-state.md)