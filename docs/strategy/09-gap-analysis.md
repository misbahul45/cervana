# Gap Analysis

> **Status**: `planned` · **Owner**: `principal-architect` · **Last reviewed**: `2026-10-02`
>
> One ranked gap matrix that drives the roadmap; every gap carries a verified evidence tag, and gaps that [`01-verification-delta.md`](./01-verification-delta.md) shows as closed are not listed.

Severity: `C` blocks the loop or is a live security or integrity risk, `H` blocks a stage or leaks value, `M` degrades quality or scale, `L` cleanup. Stage numbers refer to [`14-roadmap.md`](./14-roadmap.md). IDs: `G-<area>-nn` with area B business, P product, A AI, T technical, U UX and accessibility, D data and analytics, L legal and compliance. Evidence tags: `V` verified (delta row or path), `D` doc only, `M` evidence missing.

---

## 1. Matrix

### 1.1 Business

| ID | Gap | Evidence | Impact on the loop | Sev | Fix | Stage |
|---|---|---|---|---|---|---|
| G-B-01 | No credit revenue: a package cannot be ordered or bought | V: VD S-07, VF-01 | Credit loop and tutor cost recovery cannot start | H | `AI_CREDIT_PACKAGE` order item, reservation table, tariff | 4 |
| G-B-02 | Hold days default to 0 while the refund window is 7: creators can withdraw before refunds close; a later refund fails | V: VD HC-13 | Money loop leaks both ways | H | Align defaults (D-05) and document env keys | 0 |
| G-B-03 | No creator incentive tied to quality: earnings are a price share; no reward rule, no rubric score on products | V: VD S-08, S-06 | Peer supply quality is not rewarded | M | Reward engine with approval and outcome rules | 4 |
| G-B-04 | Platform-owned `Topic` sales run through the marketplace path and create no creator earning | V: VD §3.1 | Two product models, accidental fee of 100 percent | M | Retire Topic as product (D-16) | 2 |
| G-B-05 | No pricing, conversion or order-value data; unit economics are parameters | M | Break-even cannot be computed from data (`02-business-model.md` §4) | M | Pilot measurement (D-19) | 5 |
| G-B-06 | No institution channel: no seat model, no cohort view | M | Later revenue stream has no entity | L | Defer; design after pilot | 7 |

### 1.2 Product

| ID | Gap | Evidence | Impact on the loop | Sev | Fix | Stage |
|---|---|---|---|---|---|---|
| G-P-01 | Sandbox has no route, no UI, no seeded scenario | V: VD S-16 | The core differentiator is unreachable | C | Module, routes, journal workspace, platform scenarios | 1 |
| G-P-02 | No diagnostic, onboarding or path view | V: VD §5 (no pages) | No placement, no next activity | H | Onboarding, skill tree, dashboard | 1 |
| G-P-03 | No studio UI for articles and classes | V: `find apps/web/app/pages` (no `studio`) | Creator supply cannot be authored in the product | H | Studio routes | 2 |
| G-P-04 | No review queue or reviewer capability | V: VD K-09 | Peer content ships unreviewed or blocks on one admin | H | Reviewer capability (D-12), queue | 2 |
| G-P-05 | No admin UI for payments, payouts, refunds, applications, moderation | V: VD S-14 | Money and approvals run through API clients only | H | Admin layout and screens | 2 |
| G-P-06 | No become-creator UI; application has no evidence fields | V: `teacher/applications/applications.dto.ts` | Learner-to-creator step is invisible | H | `/become-creator` with evidence | 2 |
| G-P-07 | No learner analytics; creator analytics are 2 routes without a studio view | V: VD §5 | Creators cannot improve from outcomes | M | Mastery and outcome views | 2 |
| G-P-08 | No portfolio or verified badges | V: grep (no model) | Mastery evidence has no outlet | M | Badges and portfolio (D-03) | 7 |
| G-P-09 | Marketplace and checkout pages exist but call URLs and routes the API does not serve (see G-U-07) | V: VD VF-20 | The first purchase path cannot complete in the browser | H | Move the calls to the shared request helper and the real routes | 0 |

### 1.3 AI

| ID | Gap | Evidence | Impact on the loop | Sev | Fix | Stage |
|---|---|---|---|---|---|---|
| G-A-01 | No learner-model writer; `LearningEvent` has no writer; the mastery formula saturates | V: VD S-09, VF-02 | No mastery, no stages, no adaptive policy | C | Event ingest, corrected rule, golden vectors | 1 |
| G-A-02 | Scores are client-writable: quiz attempt `score`, `status`; answer `isCorrect`, `pointsEarned` | V: `quizAttempets.dto.ts:10-12`, `answers` DTO `:10-11` | Mastery and rewards can be forged | C | Server-side scoring, strict DTOs | 1 |
| G-A-03 | `ai-api` validates the caller on 2 of 6 routes (the resources router only); one auth check is unreachable; tokens in query strings, Celery args and BullMQ data | V: VD VF-07, VF-17 | Cost abuse, token leakage | C | Validate on every route; acting-user headers; no tokens in jobs | 0 |
| G-A-04 | `api` to `ai-api` jobs fail: `AI_URL` is defined nowhere | V: VD VF-16 | Resource extraction and embedding never run | H | Define `AI_URL`, signed calls | 0 |
| G-A-05 | No agent runtime, tool registry, budgets, trace writer in `ai-api` | V: VD S-10 | No safe tutor with credits | H | Runtime, registry, budgets (`07-ai-architecture.md` §6) | 4 |
| G-A-06 | AI credit service unwired and incompatible with the append-only ledger | V: VD VF-01 | Credit spend impossible | H | Reservation table and service | 4 |
| G-A-07 | Chat citations stored as `[]`; RAG filter is `source = material` only | V: VD S-12, VF-07 | Answers are not grounded or attributable; scope leaks | H | Chunk-id citations, tenant, status, entitlement filters | 4 |
| G-A-08 | Injection detector has no production caller; chat prompt is not fenced | V: VD S-12 | Poisoned documents steer the tutor | H | Quarantine, fences, tests ST-08 to ST-10 | 4 |
| G-A-09 | Memory write policy missing; memory read by user only; no export or delete | V: `memory_embedding.py:121-130`; VD S-03 | Pollution, privacy risk | M | Policy in `api`, retrieval filters, privacy routes | 5 |
| G-A-10 | Evaluation is heuristic; no frozen benchmark, no judge agreement, no gate | V: VD VF-05 | Self-improvement has no safe base | M | Benchmark, judge calibration, gate | 6 |
| G-A-11 | Browser calls `ai-api` directly with the user JWT | V: VD S-13 | Credit-spending calls bypass `api` | M | Proxy through `api` (D-13) | 4 |
| G-A-12 | Tutor endpoint returns a template; policy never persisted; mastery looked up by mixed ids | V: VD VF-06 | A route that looks like a tutor but is not | M | Replace with the run flow after stage 1 | 1 |

### 1.4 Technical

| ID | Gap | Evidence | Impact on the loop | Sev | Fix | Stage |
|---|---|---|---|---|---|---|
| G-T-01 | Curriculum writes: any `TEACHER` edits any lesson, step, subtopic, quiz, question; `Topic.createdBy` from the body | V: VD S-18 | Cross-teacher tampering | H | Author or tenant ownership checks | 1 |
| G-T-02 | Paid curriculum content readable by any signed-in user | V: VD VF-14 | Revenue leakage on topics that are sold | H | Free-or-entitlement gate on lesson and step reads | 0 |
| G-T-03 | Nine database integration suites and the prerequisite suite skip by default | V: VD §9 | Triggers and constraints go untested in routine runs | H | CI job with a scratch database | 0 |
| G-T-04 | No scheduler: `releaseDue`, payment expiry sweep, credit expiry have no trigger | V: VD VF-10 | Non-zero hold leaves earnings `PENDING` | H | BullMQ repeatable jobs | 3 |
| G-T-05 | Seven services without a module; unwired code with defects | V: VD VF-04 | Dead code that tests mask | M | Register after fixing or delete | 0 |
| G-T-06 | `Idempotency-Key` header is not enforced: `IdempotencyService` has no module and no caller | V: grep | Money and credit routes rely on constraints and locks only | M | Apply to every money, credit, event and AI-run route | 3 |
| G-T-07 | Replay cache for signed requests is in process memory | V: `internal-service.guard.ts:42` | Replay protection fails with two replicas | M | Redis-backed cache | 4 |
| G-T-08 | Synchronous consumers inside the approval transaction | V: VD S-20 | Approval latency grows with consumers | M | Outbox for non-critical consumers | 3 |
| G-T-09 | Celery starts as a subprocess in every `ai-api` container; its test passes vacuously | V: VD VF-11 | Dev and prod differ; duplicate workers in prod | M | Remove subprocess; add a compose service | 0 |
| G-T-10 | `/metrics` is public; no tracing (no OpenTelemetry) | V: VD VF-08, grep | Information exposure; no cross-service traces | M | Restrict route (D-17); OTel in both services | 4 |
| G-T-11 | `.env.example` lacks `CREATOR_EARNING_HOLD_DAYS`, `REFUND_WINDOW_DAYS`, `PAYOUT_MIN_AMOUNT`, `AI_URL` | V: VD VF-09, VF-16 | Operators cannot configure money policy | M | Add keys with defaults | 0 |
| G-T-12 | Leftover legacy: `Order.amount Float`, `snapToken`, `gateway`, unused `STRIPE_*` | V: VD §3.1, S-20 | Confusion, float money writable | L | Drop after dual read | 3 |
| G-T-13 | Authorization matrix lists 195 of 273 routes; progress tracker has 84 broken links | V: VD HC-01, §8 | Reviewers rely on stale documents | L | Regenerate; repair links | 0 |
| G-T-14 | Dev database has no migration history | M: not checked (rule) | `migrate deploy` needs a baseline | M | Baseline steps in the Phase 1 report | 0 |
| G-T-15 | No optimistic concurrency (`If-Match`) for authoring | V: grep | Lost updates between tabs | L | Version check on `PATCH` | 2 |
| G-T-16 | nginx strips `/api/` and `/ai/` while the services mount `api/v1` and `/ai/v1`; every browser call through nginx would answer `404` | V: VD HC-14, VF-19 | Nothing reaches the services from a browser behind nginx | H | Keep the prefix in `proxy_pass` (no trailing slash) and re-run the documented checks (R-03) | 0 |
| G-T-17 | The prerequisite cycle check tests the wrong direction, so the graph can gain a cycle; no database rule backs it | V: VD VF-21 | Skill tree, levels and placement assume a DAG | M | Correct reachability check and a trigger (M-15) | 1 |

### 1.5 UX and accessibility

| ID | Gap | Evidence | Impact on the loop | Sev | Fix | Stage |
|---|---|---|---|---|---|---|
| G-U-01 | Web has no role-aware layouts; middleware knows signed-in versus public only | V: `auth.global.ts:8-35` | Studio and admin cannot be separated for UX | H | Layouts, `requiresRole` meta | 2 |
| G-U-02 | Space theme remains: five components still imported by ten files; `Math.random` in render at three places | V: VD §7 TU-04, TU-05 | Hydration warnings; mixed identity | M | Finish TU-04, TU-05 | 0 |
| G-U-03 | No measured accessibility or performance evidence for any page | V: VD §7 S-06, TU-09 not started | WCAG claims unproven | M | Playwright matrix and budgets | 0 |
| G-U-04 | Marketplace recommendations call a URL without `/api` | V: VD VF-15 | Page shows an error state | L | Use the shared request helper | 0 |
| G-U-05 | Copy promises without labels: no "Segera" marker for planned features | V: VD §7 TU-07 | Over-promise (B-03) | L | Add labels | 0 |
| G-U-06 | AI UX rules absent: credit cost confirm, AI label, citations list, split of AI explains and engine grades | V: none exist | Users cannot tell AI from graded results | M | Components in stage 4 | 4 |
| G-U-07 | 14 raw `$fetch('/v1/...')` calls without `/api`; `pay.vue` calls three undefined routes; detail pages pass a slug to id routes | V: VD VF-20 | Marketplace, orders and creator pages fail on load | H | Use the shared request helper, the real routes, and id or slug lookup that matches the API | 0 |

### 1.6 Data and analytics

| ID | Gap | Evidence | Impact on the loop | Sev | Fix | Stage |
|---|---|---|---|---|---|---|
| G-D-01 | No event stream: KPIs A1 to A4, S1 to S3, H1 cannot be computed | V: `05-circular-economy.md` §6 status column | Guardrails cannot run | H | `LearningEvent` ingest | 1 |
| G-D-02 | No pilot protocol, no baselines | M | Thresholds are parameters with no values | M | D-19 | 5 |
| G-D-03 | No privacy-scoped aggregation (`k_min`) | M | Small cohorts allow re-identification | M | Aggregation layer | 5 |

### 1.7 Legal and compliance

Items marked `legal review` need qualified advice; this file records the technical gap only.

| ID | Gap | Evidence | Impact on the loop | Sev | Fix | Stage |
|---|---|---|---|---|---|---|
| G-L-01 | No consent, terms or privacy-policy acceptance records; no age band or guardian fields | V: grep `schema.prisma` | Personal data of minors (D-02) and adults has no recorded basis | H (C if D-01 is B or C) | Consent records, age band, guardian consent (legal review) | 1 |
| G-L-02 | No data export or deletion route | V: `routes.json` (0 matches) | Data subject rights cannot be served | H | `GET /me/data-export`, `POST /me/deletion-request` | 1 |
| G-L-03 | Payout destination is free-form JSON per request; no payee identity or tax handling | V: `schema.prisma` `PayoutRequest.destinationInfo` | Payout compliance unmodeled | H | `TenantSettings` destination, verification step (legal review) | 3 |
| G-L-04 | Credits can be treated as cash-like value if earned and redeemable | D: `circular-economy-model.md` §3.3 | Financial regulation exposure | M | Closed-loop, non-cashable rule (D-06, legal review) | 4 |
| G-L-05 | No creator content licence or terms acceptance | V: grep | Rights to sell and republish unclear | M | Terms at application (legal review) | 2 |
| G-L-06 | Payment proof is a client-supplied URL, not fetched or verified | V: Phase 3 report §7 | Fraud risk in manual review | M | Fetch check, hash, admin tooling | 3 |

---

## 2. Ranking for the roadmap

Top gaps by severity, then by how many later gaps they block; G-P-04 (no reviewer) and G-L-01 (no consent basis before a pilot) rank 11 and 12.

| Rank | Gap | Why first |
|---|---|---|
| 1 | G-A-03 | Live cost and token exposure on a public route |
| 2 | G-A-02 | Forgeable scores undermine mastery, rewards and creator eligibility |
| 3 | G-T-16 | Nothing is reachable from a browser behind nginx |
| 4 | G-U-07 | The first purchase path fails on load |
| 5 | G-P-01 | The differentiator is unreachable |
| 6 | G-A-01 | Blocks stages, rewards, KPIs |
| 7 | G-T-03 | Money triggers untested in routine runs |
| 8 | G-B-02 | Live finance policy conflict |
| 9 | G-T-02 | Revenue leakage on sold topics |
| 10 | G-A-04 | RAG ingestion cannot run |

## 3. Closed or restated gaps (not listed above)

| Candidate from the master prompt | Result | Evidence |
|---|---|---|
| Earnings never mature | Restated: they release at fulfilment by default; they stay `PENDING` only with a non-zero hold and no scheduler | G-B-02, G-T-04 |
| No checkout UI | Closed in part: order list, pay and submitted pages exist | VD S-14 |
| Deprecated order fields in the UI | Closed: the order page reads `total` and `payment.provider` | VD S-14 |
| Article, class, wallet, payout, refund services missing | Closed: implemented on the API | VD HC-03, HC-04 |
| Similarity endpoint missing | Closed: `GET /chat/contents/similarity` exists | `contents.controller.ts:28` |
| Wallet unique, ledger direction, cascade deletes, publishedVersionId FK | Closed | VD §3.1 |
| Stale test and no ownership checks in `docs/audit` | Closed | VD K-04 |
