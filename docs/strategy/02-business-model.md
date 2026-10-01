# Business Model — Circular Learning Economy, Accounting First

> **Status**: `planned` · **Owner**: `product-strategist` · **Last reviewed**: `2026-10-02`
>
> The economic and value model of the learner-to-creator loop, grounded in what the repository implements today; every number that was not measured is a symbol with a labeled assumption.

Facts about the current system come from [`01-verification-delta.md`](./01-verification-delta.md) (VD). Owner decisions are in [`decision-register.md`](./decision-register.md) (DR). Segment used throughout: D-01 option A (university accounting students) [ASSUMPTION: D-01 is `PROPOSED`, not accepted].

---

## 1. Purpose

Answer five questions with evidence or assumption tags, fill the Business Model Canvas with items tagged `exists`, `planned` or `assumption`, give a unit-economics skeleton, and challenge five weak points of the model.

---

## 2. The five vision questions

### 2.1 Which problems, for which segment

| Problem | Segment (D-01 A) | Evidence in the repo | Tag |
|---|---|---|---|
| Journal, ledger and trial balance are learned from text and graded late, so errors repeat | University accounting students | Curriculum chain `fundamentals` to `financial-statements` exists; a deterministic engine exists but has no route (VD S-16) | [VERIFIED: `seed-golden-graph.ts:25-170`, `accounting-sandbox.service.ts`] |
| Students who master a topic have no path to teach and earn | Students who become creators | Teacher application, tenant provisioning, article and class products, wallet and payout are implemented (VD HC-03, HC-04) | [VERIFIED: `routes.json`] |
| Peer content has no quality gate | Learners buying from peers | Only `ADMIN` moderates (VD K-09) | [VERIFIED: `articles/admin-articles.controller.ts`] |
| Tutor help is generic and ungrounded | All learners | Chat pipeline retrieves with `source = material` only (VD S-12) | [VERIFIED: `v1/learning/service.py:94`] |

### 2.2 Stakeholders

| Stakeholder | Role in the loop | Exists today |
|---|---|---|
| Learner | Learns, practices, buys, earns credits | `STUDENT` role, orders, manual payment |
| Creator | Publishes article or class, earns, withdraws or reinvests | `TEACHER` role plus tenant `OWNER`; wallet, payout |
| Reviewer | Approves content for publication | No such actor; `ADMIN` only (D-12) |
| Platform admin | Reviews payments, payouts, refunds, applications | Implemented routes, no UI |
| Payment operator | Compares proof against bank statement | Manual review queue API, no UI; same person as admin today |
| Guardian | Consents for a minor | Not built; only if D-02 applies |
| Lecturer or university | Adopts the platform for a course; later buys a licence | No actor; no tenant type for institutions [ASSUMPTION: institution channel is a later stage] |
| Future employer | Reads verified portfolio evidence | No actor; D-03 limits claims to evidence |

### 2.3 Value exchange

| From | To | Gives | Gets | Mechanism |
|---|---|---|---|---|
| Learner | Platform | Payment for a product | Entitlement | `Order`, `PaymentIntent`, `PaymentVerified`, `Entitlement` |
| Platform | Creator | Creator share | Content supply | `CreatorEarning`, `LedgerTransaction`, `Wallet` |
| Creator | Platform | Published product | Fee on each sale | `PLATFORM_FEE_PERCENT` snapshotted per `OrderItem` |
| Creator | Platform | Payout request | Transfer of wallet funds | `PayoutRequest`, ledger `PAYOUT` debit |
| Learner | Platform | Refund request | Money back, access revoked | `Refund`, `RefundCompleted`, earning reversal |
| Learner | Platform | Practice attempts, answers | Deterministic grading, mastery estimate | `SandboxAttempt` (planned route), `TopicMasteryRecord` (writer missing) |
| Platform | Learner | Hint or explanation | Reduced time to mastery (to be measured) | Tutor call with credit reservation (planned, stage 4) |
| Learner | Platform | Credit purchase | AI credits | `Order` item `AI_CREDIT_PACKAGE` (planned, VD S-07) |
| Creator | Platform | Wallet balance as payment | Credits or another creator's product | `WALLET` payment adapter (planned, D-07) |
| Reviewer | Creator | Review decision | Publication | `ReviewItem` (planned, D-12) |
| Learner | Creator | Purchase, outcomes | Revenue, analytics | `creator-analytics` routes (partial) |
| University | Platform | Licence fee | Cohort analytics, seats | Not modeled [ASSUMPTION] |

### 2.4 Economic model

| Stream | Mechanism | Status |
|---|---|---|
| Article and class sales with platform fee | `OrderItem.platformFee` at `PLATFORM_FEE_PERCENT` (default 10) | exists |
| Platform-owned topic sales | `Order.topicId`; topics have no tenant, so the platform keeps 100 percent | exists, scheduled for removal (D-16) |
| AI credit packages | `AICreditPackage`, `AiCreditsService.topUp` | planned (table has no writer, service unwired, VD VF-01) |
| Institution licence | none | assumption, stage 7 or later |
| Agent product sales | none | planned, after D-09 preconditions |

### 2.5 What is different, and what exists

| Difference | Exists today | Evidence |
|---|---|---|
| Deterministic accounting sandbox that grades, never an LLM | partial: engine, tables, tests; no route; compound-entry defect | VD VF-03 |
| Peer creators backed by mastery evidence | planned: mastery writer missing, application form has no evidence fields tied to mastery | VD S-09, [VERIFIED: `teacher/applications/applications.dto.ts`] |
| Closed learn-create-earn loop | partial: money half is built; credit half and mastery half are not | VD HC-03, HC-05 |

---

## 3. Business Model Canvas

| Block | Items | Tag and module |
|---|---|---|
| Customer segments | University accounting students (learners and creators) | assumption D-01 A |
| | Lecturers who assign platform content | assumption |
| | Minors (SMA) | planned only under D-02 |
| Value propositions | Graded practice in a journal workspace with instant, deterministic feedback | planned, `AccountingSandboxService` |
| | Tutor that explains inside the curated prerequisite graph | partial, `SubTopicPrerequisite`, `TutorService` |
| | Earn by teaching what you have mastered | partial, tenant, article, class, wallet |
| Channels | Web app (Nuxt), SSR landing, marketplace pages | exists, 34 pages; marketplace and checkout pages do not reach the API yet (VD HC-15) |
| | University course adoption | assumption |
| Customer relationships | In-product tutor, notifications | partial, `Notification`, SSE |
| | Creator analytics | partial, `creator-analytics` |
| Revenue streams | Platform fee on creator sales | exists |
| | AI credit packages | planned |
| | Platform-owned course sales | exists, to be retired (D-16) |
| | Institution licence | assumption |
| Key resources | Golden graph and scenario library | exists (10 nodes), planned (scenarios) |
| | Accounting engine | partial |
| | Creator supply with reviewed content | planned |
| Key activities | Content review, payment and payout review, scenario authoring | planned UI, API exists |
| Key partners | Bank for manual transfer; LLM gateway (`OPENAI_BASE_URL`); Hugging Face embeddings; future payment gateway | exists, exists, exists, assumption (D-14) |
| Cost structure | LLM calls, embeddings, hosting (Postgres, Redis, Qdrant), admin hours for manual review, support | symbols in §4 |

---

## 4. Unit economics skeleton

All values are parameters. The skeleton formulas are fixed by the master prompt; the symbols below name each input.

```text
ARPU_learner               = conv * AOV * orders_per_year + credit_revenue_per_learner
fee_revenue_per_learner    = conv * AOV * orders_per_year * tau
cost_ai_per_active_learner = sessions_per_month * calls_per_session * c_call * k_ctx
contribution_per_learner   = fee_revenue + credit_margin - cost_ai - payment_ops_cost - support_cost
creator_take               = sum(order_item_total - platform_fee) per creator per month
break_even_AOV             = 12 * sessions_per_month * calls_per_session * c_call * k_ctx / (conv * orders_per_year * tau)
```

| Symbol | Meaning | Source or tag |
|---|---|---|
| `conv` | Share of active learners who buy at least once per year | [ASSUMPTION: no sales data] |
| `AOV` | Average order value | [ASSUMPTION: no pricing set; not invented here] |
| `tau` | Blended platform share of GMV, between the fee `f` and 1 | `f` = 0.10 [VERIFIED: `commerce.config.ts` default]; mix is [ASSUMPTION] |
| `c_call` | Cost per tutor call with a short prompt | USD 0.00015 to 0.00035 per question including reasoning tokens, flash model, one afternoon, short numeric prompts [DOC-ONLY: `plans/reducera-v1-execution-plan.md` §3.4] |
| `k_ctx` | Multiplier for retrieved context and chat history, at least 1 | [ASSUMPTION: not measured] |
| `B_llm` | Monthly LLM ceiling | owner placeholder, D-21 |

### 4.1 Scenarios (inputs are assumptions)

| Input | Low | Base | High | Tag |
|---|---|---|---|---|
| `conv` | 0.01 | 0.03 | 0.06 | [ASSUMPTION] |
| `orders_per_year` | 1 | 2 | 3 | [ASSUMPTION] |
| `tau` | 0.10 | 0.10 | 0.30 | [ASSUMPTION: High assumes more platform-owned content] |
| `sessions_per_month` | 4 | 8 | 12 | [ASSUMPTION] |
| `calls_per_session` | 3 | 6 | 10 | [ASSUMPTION] |
| `c_call * k_ctx` (USD) | 0.00035 | 0.00025 | 0.00015 | [ASSUMPTION: range from the benchmark with `k_ctx` = 1] |
| `break_even_AOV` (USD, derived) | 50.4 | 24.0 | 4.0 | formula above applied to the inputs |

Derivation: base `12 * 8 * 6 * 0.00025 / (0.03 * 2 * 0.10) = 0.144 / 0.006 = 24.0`; low `12 * 4 * 3 * 0.00035 / (0.01 * 1 * 0.10) = 0.0504 / 0.001 = 50.4`; high `12 * 12 * 10 * 0.00015 / (0.06 * 3 * 0.30) = 0.216 / 0.054 = 4.0`.
Reading: when free tutor usage is funded from the fee alone, the average order must be large relative to a short-prompt call cost, because the fee is a small share of a small number of orders while every active learner, paying or not, consumes calls. The conclusion holds for the ratios assumed above and changes with `conv`, `tau` and `k_ctx`; the inputs must be measured in the pilot (D-19) before any price is set.

### 4.2 Consequence for design

| Rule | Reason |
|---|---|
| Tutor usage beyond a free daily allowance is paid with credits; price per credit at least cost per credit times margin (D-06) | In the low and base scenarios the fee alone covers free usage only above the break-even `AOV` (USD 50.4 and 24.0); usage grows with every active learner, revenue only with buyers |
| The free allowance is a parameter `F` calls per day, set from `B_llm` and active learners | A hard ceiling is the only guard against cost above revenue (D-21) |
| `cost_ai_per_active_learner` and `credit earn:spend` are guardrail KPIs (`05-circular-economy.md` §6) | Both must not worsen across releases |

---

## 5. Challenges

| Topic | Challenge | Recommendation |
|---|---|---|
| Cold start | A marketplace without supply has nothing to buy, and creators leave without buyers. Today the repo has one seeded topic chain and no seeded creator content | Seed supply first: platform-authored golden graph and sandbox scenarios, free classes by invited creators, and keep payouts closed until a real purchase has passed the full payment, hold and refund window. Open paid creator sales in stage 2, payouts in stage 3 |
| Creator quality | Beginners cannot judge incorrect accounting, and one wrong explanation sold as a class harms learners and the brand. Only `ADMIN` can moderate (K-09) | Grant a reviewer capability through `ADMIN` (D-12); require a passing sandbox scenario authored or approved by the creator for any article that teaches a procedure; show review status on each product |
| Willingness to pay and what carries revenue first | No sales data exists; manual transfer adds friction; students pay little | Make creator sales and platform courses the first revenue, keep AI credits as the cost-recovery layer for tutor usage beyond the free allowance; measure `conv` and `AOV` in the pilot before setting prices |
| AI cost per learner against revenue | In the base scenario the fee alone funds free usage only when `AOV` exceeds the break-even of USD 24.0 (§4.1) | Enforce the allowance `F`, route paid calls through `api` reserve and settle (D-13), publish cost per active learner as a guardrail KPI |
| Is accounting alone enough | A single vertical limits market and the loop's content supply. The architecture already treats accounting as a domain: the sandbox is the only accounting-specific engine, curriculum and marketplace are generic | A second vertical needs: a deterministic grader for its domain (the role of the sandbox engine), a prerequisite graph, a scenario format, and a copy guard profile. Defer until the accounting pilot shows retention; keep the engine behind an interface (`AccountingContext`, V1 plan A-03) |

---

## 6. Trade-offs

| Choice | Alternative | Why this choice |
|---|---|---|
| Revenue on creator fee first | Subscription for learners | The payment, ledger and refund pipeline for per-item sales exists; a subscription needs billing and renewals that nothing implements |
| Credits closed-loop | Cash-redeemable credits | Cash-like value brings financial and legal obligations (D-06 legal review) |
| Manual payment in V1 | Gateway now | Abstraction is ready, webhook `501`; a gateway adds provider fees and reconciliation work before volume exists (D-14) |

## 7. Acceptance criteria

| Criterion | Test |
|---|---|
| Every canvas item has a tag and a module or assumption | Review of §3 |
| No price, market size or conversion appears as a fact | `grep` for currency amounts in this file returns only labeled assumptions |
| The pilot (D-19) measures `conv`, `AOV`, `sessions_per_month`, `calls_per_session`, `k_ctx` | KPI list in `05-circular-economy.md` §5 |
