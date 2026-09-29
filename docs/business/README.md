# Business Flows — Index

> **Status**: `planned` · **Owner**: `architect` · **Last reviewed**: `2026-09-30`
>
> Index of all business flow documents. Each BF documents the *why* and the *what* from the actor's perspective. It links downward to a Data Flow and a System Flow.

---

## 1. What lives here

Every BF answers five questions:

1. **Why** does this capability exist?
2. **Who** is the actor?
3. **What** happens from a business perspective?
4. **What decisions** are made and on what basis?
5. **What outcome** is produced and what business rule applies?

A BF never describes implementation. It describes intent and business process only.

---

## 2. The circular-economy anchor flows

| ID | Flow | Why it matters for the circular economy |
|---|---|---|
| [BF-001](./flows/BF-001-learning-loop.md) | User Learns Accounting Concept | Core consumption loop. Without this, nothing else matters. |
| [BF-002](./flows/BF-002-purchase-course.md) | User Purchases Course | Money flows in. Without purchase, no creator revenue, no AI credit top-up. |
| [BF-003](./flows/BF-003-creator-earnings.md) | Creator Receives Revenue Share | Money flows out (creator side). The loop closes: learn → create → sell → earn → reinvest. |
| [BF-004](./flows/BF-004-ai-credit-cycle.md) | Learner Earns and Spends AI Credits | In-app credit economy that funds AI assistance without requiring new money. |

These four together form the economic loop:

```
   BF-001 (Learn)
        │
        ▼
   BF-002 (Buy)
        │
        ▼
   BF-003 (Creator earns)
        │
        ▼
   Reinvest (in AI credits or other courses)
        │
        ▼
   BF-004 (AI credits: earn, buy, use)
        │
        └──→ BF-001 (Learn)
```

---

## 3. Planned flows (to be authored)

| ID | Flow | Notes |
|---|---|---|
| BF-005 | Creator Publishes Article | Entry point of the acquisition funnel |
| BF-006 | Creator Hosts Free Class | Scheduled learning event, price=0 |
| BF-007 | Tutor Schedules Paid Class | Scheduled learning event, price>0 |
| BF-008 | Learner Diagnosed, Next Activity Recommended | AI engine surfaces options, learner chooses |
| BF-009 | Learner Takes Certification Mock Assessment | Certification readiness evidence |
| BF-010 | System Certifies Readiness | Aggregated competency + completion + time-on-task → readiness verdict |
| BF-011 | Tutor Reviews Class Performance | Tutor-side analytics, AI-assisted |
| BF-012 | AI Credit Earned from Free Class Attendance | Connects learning → AI economy |
| BF-013 | AI Credit Top-up via Payment | Connects money → AI economy |
| BF-014 | Refund Issued for Cancelled Order | Money reverse path |
| BF-015 | Creator Requests Payout | Wallet → bank transfer |
| BF-016 | Admin Moderates Reported Content | Platform safety |

---

## 4. How to read a BF doc

Every BF doc has the same structure:

```
# BF-XXX — [Flow Name]

## Purpose        — why this flow exists
## Actor          — who initiates or participates
## Trigger        — what starts the flow
## Preconditions  — what must already be true
## Flow           — numbered business steps
## Decisions      — branching business rules
## Outcome        — resulting state
## Business Rules — invariants the flow must preserve
## Related        — links to DF-XXX and SF-XXX
```

---

## 5. When to add a new BF

Create a new BF when:

- The capability is a distinct user journey (not a CRUD helper).
- It changes business state (purchase, lesson completion, certification).
- It has business decisions (refund policy, streak eligibility).

Do **not** create a new BF for:

- Internal database operations (those go in `architecture/`).
- Implementation patterns (those go in `implementation/`).
- One-off edge cases (extend the nearest existing BF instead).

---

## 6. When to update an existing BF

If you change a behavior that affects the actor or the outcome, edit the BF. Do **not** create a new sibling BF for "v2 of the same flow".

---

## 7. Cross-references

Each BF doc links to:

- A `DF-XXX` doc — the data the flow consumes and produces.
- A `SF-XXX` doc — the technical components that execute the flow.
- An `architecture/` doc — for the entity schemas referenced.

If any of these links are missing, the BF doc is incomplete.