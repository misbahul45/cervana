# ReduCera — Documentation

> **Status**: `planned` · **Owner**: `architect` · **Last reviewed**: `2026-09-30`
>
> Entry point for ReduCera planning documentation. Organized around **Business Flow → Data Flow → System Flow** triplets that describe the **circular learning economy** end-to-end.

---

## 1. What ReduCera is

ReduCera is a **learning marketplace + AI learning infrastructure + creator economy**, not just an AI tutor. The economic loop is:

```text
LEARN
  ↓
build expertise
  ↓
CREATE (Article / Free Class / Paid Course)
  ↓
PUBLISH
  ↓
learners consume
  ↓
REVENUE
  ↓
Creator Wallet
  ↓
PAYOUT  +  REINVEST in AI Credits / other courses
  ↓
LEARN  →  CREATE  ↺
```

The AI engine sits **on top** of this loop, not as its replacement. AI knows where the learner is in this cycle and recommends the next learning activity; it does not own commercial decisions.

---

## 2. How this documentation is organized

Every major capability is documented as a **flow triplet**:

```
BUSINESS FLOW  (BF)   — actor, goal, trigger, business activity, decisions, outcome
       ↓
DATA FLOW       (DF)  — input, transformation, storage, retrieval, output
       ↓
SYSTEM FLOW     (SF)  — frontend, API, service, worker, queue, DB, AI, RAG, memory
       ↓
IMPLEMENTATION        — file paths, functions, modules
       ↓
VALIDATION            — tests, eval datasets, checks
```

Same capability, four lenses. Identical IDs (`BF-001` ↔ `DF-001` ↔ `SF-001`).

---

## 3. Directory map

```
docs/
├── README.md                    ← you are here
├── progress-tracker.md          ← task list with status
├── STYLE-GUIDE.md               ← meta-doc
│
├── business/
│   ├── README.md                ← business flow index
│   └── flows/                   ← BF-XXX documents
│
├── data/
│   ├── README.md                ← data flow index
│   └── flows/                   ← DF-XXX documents
│
├── system/
│   ├── README.md                ← system flow index
│   └── flows/                   ← SF-XXX documents
│
├── architecture/
│   ├── current-state.md         ← what exists today
│   ├── target-state.md          ← what we're building toward
│   └── service-map.md           ← service inventory
│
├── implementation/
│   ├── service-map.md
│   └── traceability.md
│
├── decisions/
│   └── README.md                ← ADRs
│
└── testing/
    └── traceability.md
```

Each BF/DF/SF doc cross-references its siblings by ID and points at concrete implementation paths.

---

## 4. Anchor flows (the four that establish the circular loop)

| ID | Business Flow | Purpose |
|---|---|---|
| BF-001 | User Learns Accounting Concept | Core learning loop |
| BF-002 | User Purchases Course | Money in |
| BF-003 | Creator Receives Revenue Share | Money out (creator side) |
| BF-004 | Learner Earns and Spends AI Credits | In-app credit economy |

These four together describe the circular economy:

```
BF-001 (Learn) → BF-002 (Buy) → BF-003 (Creator earns) → Reinvest → BF-004 (AI Credits)
                                          ↑
                          BF-004 (Earn) ←─┘
```

---

## 5. Quick navigation

**If you are engineering**:
1. [`progress-tracker.md`](./progress-tracker.md) — what is done, blocked, next.
2. [`architecture/current-state.md`](./architecture/current-state.md) — what is actually in the repo.
3. [`architecture/target-state.md`](./architecture/target-state.md) — destination architecture.

**If you are designing a feature**:
1. Read the relevant BF doc → understand actor, goal, business rules.
2. Read the matching DF doc → understand data, storage, events.
3. Read the matching SF doc → understand services, queues, AI, RAG.
4. Implement. Update the docs only if behavior changed.

**If you are reviewing**:
1. Each BF/DF/SF triplet must answer "how does this feature work from business intent to code?"
2. If you cannot trace one BF to a DF to a SF, the doc is incomplete.

---

## 6. Conventions

- Status labels (per `STYLE-GUIDE.md`): `implemented` / `partial` / `scaffolded` / `referenced` / `planned`.
- Priority: `P0` / `P1` / `P2` / `P3`.
- Task status: `[ ]` / `[~]` / `[x]` / `[!]`.
- Stable IDs: `BF-XXX`, `DF-XXX`, `SF-XXX` for flows. `PL-XXX` for plans. `IMPL-XXX` for implementation. `C-XXX` / `H-XXX` / `M-XXX` / `L-XXX` for findings.

---

## 7. What this tree does NOT contain

- Implementation code (lives in `services/api/`, `services/ai-api/`, `apps/web/`).
- Test code (lives in service directories).
- Generated content from the AI service.

When implementation begins, flow docs gain an "Implementation References" section that names the actual files.