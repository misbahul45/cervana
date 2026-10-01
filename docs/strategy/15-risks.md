# Risk Register

> **Status**: `planned` · **Owner**: `owner` · **Last reviewed**: `2026-10-02`
>
> Risks of the plan and of the current system, each with an early signal, a mitigation, an owner role and the stage that retires it.

Facts: [`01-verification-delta.md`](./01-verification-delta.md) (VD). Gaps: [`09-gap-analysis.md`](./09-gap-analysis.md). Likelihood and impact use `L`, `M`, `H`; they are judgments from the verified evidence, not measurements. Categories: pedagogy, finance, legal, AI safety, security, technical, market. Owner is a role: `owner` (product and decisions), `developer`, `admin` (platform operator), `legal` (qualified external advice, not available in the repository), `reviewer`.

---

## 1. Register

| ID | Risk | Category | Likelihood | Impact | Early signal | Mitigation | Owner | Stage |
|---|---|---|---|---|---|---|---|---|
| R-01 | Minors handle money or appear in public rankings | legal | M if D-01 is B or C, L if A | H | An age field or a school domain appears in signups; a leaderboard shows real names | Age gate, guardian consent, no wallet, payout, creator role or public board for minors (D-02); legal review | owner, legal | 1 |
| R-02 | AI credits treated as cash-like value | legal, finance | M | H | A request to withdraw or transfer credits; credits priced below cost | Closed-loop, never cashable, one-way conversion through the order pipeline (D-06); legal review | owner, legal | 4 |
| R-03 | Creator content teaches incorrect accounting | pedagogy | H | H | Reviewer rejects above `r_rej`; learners' sandbox errors cluster on a creator's topics; refunds on one product | Reviewer capability (D-12), sandbox scenario required for procedural articles, review status shown on the product, suspend by `ADMIN` | reviewer, admin | 2 |
| R-04 | LLM cost per learner above revenue per learner | finance | H | H | G-6 above `B_llm / active learners`; break-even order value not reached (`02-business-model.md` §4) | Free allowance `F`, credits for the rest, hard monthly cap and per-learner cap (D-21), cost recorded per run | owner, developer | 4 |
| R-05 | Prompt injection through creator uploads and web search | AI safety | M | H | Injection detector hits at quarantine; tool calls outside the allow-list; answer text with instructions | Quarantine and review, fences, detector wired at ingest and retrieval, domain allow-list, safety tests `ST-08` to `ST-10` | developer | 4 |
| R-06 | Reward farming of XP, streaks or credits | AI safety, finance | M | M | Many `ScenarioPassed` events with short elapsed time; credit earn ratio above `r_hi` | Verified events only, caps, once-per-entity keys, `T_min`, G-5 guardrail, `GM-01` to `GM-05` | developer | 4 |
| R-07 | A single admin is the bottleneck for manual payments, reviews and payouts | finance, technical | H | M | Median approval time (KPI-M4) grows; open queue age rises | Admin UI, reviewer capability, second admin account and separation of duties (D-20), notifications for old items | admin | 2, 3 |
| R-08 | Synchronous event consumers slow approvals as volume grows | technical | L now, M at volume | M | Approval transaction p95 above `L_appr` | Outbox for non-critical consumers; money and entitlement stay synchronous (ADR-008) | developer | 3 |
| R-09 | Dependence on one LLM gateway | technical | M | H | Error rate above `E_llm`; key blocked (this happened on 2026-09-30, V1 plan §11) | Second provider behind the same interface, budget-capped key, typed `LLM_UNAVAILABLE` with credit release | developer | 4 |
| R-10 | Data loss because Postgres and Qdrant backups are untested | technical | M | H | No backup artifact; no restore drill record (VD G-T-08) | Scheduled dumps and snapshots, a restore drill before the first payout (D-20) | admin, developer | 3 |
| R-11 | Nothing reaches the API from a browser behind nginx | technical | H (verified config) | H | `curl http://localhost/api/v1/docs` returns 404 (VD HC-14, VF-19) | Keep the prefix in `proxy_pass`; re-run the documented checks | developer | 0 |
| R-12 | Unauthenticated routes spend LLM budget | security, finance | H | H | Celery queue activity without matching sessions; cost spikes (VD VF-07) | Validate the caller on every route, rate limit, move before the pipeline | developer | 0 |
| R-13 | Forged scores and progress inflate mastery, rewards and creator eligibility | security, pedagogy | H | H | Quiz attempts with `score` set by the client; progress rows without events (VD G-A-02) | Server-side scoring, strict DTOs, removal list (`11-api-plan.md` §8) | developer | 1 |
| R-14 | Paid lessons are readable without purchase | finance, security | H | M | Lesson reads by users with no entitlement (VD VF-14) | Free-or-entitlement gate on lesson and step reads | developer | 0 |
| R-15 | Earnings leave before the refund window closes | finance | H | M | Wallet balance spent while refunds are open; `REFUND_EXCEEDS_BALANCE` errors (VD HC-13) | Hold at least the refund window; document env keys (D-05) | owner, developer | 0 |
| R-16 | Integration suites skipped by default hide database defects | technical | H | H | `pnpm jest` reports 143 skipped tests (VD §9) | CI job on a scratch database; fail on skipped integration suites | developer | 0 |
| R-17 | Unwired services give false confidence; defects in them surface only when wired | technical | H | M | Green unit tests over mocked clients (VD VF-01, VF-02, VF-03) | Fix then register, or delete; add database-level tests before wiring | developer | 0, 1 |
| R-18 | Personal data processed without recorded consent, export or deletion | legal | H | H | No consent table, no `/me/data-export` route (VD G-L-01, G-L-02) | Consent records, export and deletion routes, retention rules; legal review | owner, legal | 1 |
| R-19 | Payout destination and tax handling are unmodeled | legal, finance | M | H | Free-form `destinationInfo` JSON; no payee verification (VD G-L-03) | Destination in `TenantSettings`, verification step; legal review | owner, legal | 3 |
| R-20 | Manual payment proof fraud | finance | M | M | Rejected proofs rise; amount and reference mismatches | Fetch and hash check, admin tooling, limits on resubmission (exists) | admin | 3 |
| R-21 | Changing the embedding model or dimension invalidates stored vectors | technical | L | H | A new `HF_EMBEDDING_MODEL` without new collection names | Collection guard exists (refuses a size mismatch); new names and re-embed | developer | any |
| R-22 | Secrets exposed in transcripts or logs (the gateway key and the developer `HF_TOKEN` were pasted into chats) | security | M | M | Keys appear in logs or commits | Rotate, budget-capped keys, never print values, revoke the dev token when development ends | owner | 0 |
| R-23 | Memory poisoning and cross-user memory reads | AI safety, security | M | H | Instruction-like memory rows; retrieval without a user filter (VD G-A-09) | Write policy in `api`, retrieval filters, `ST-11`, `ST-12` | developer | 5 |
| R-24 | Reviewer collusion or self-review | pedagogy, security | L | M | Reviews from the same pair of accounts; approval without rubric | No self review (CHECK), sample second review, agreement KPI | admin | 2 |
| R-25 | Hydration errors and accessibility regressions in the web | technical | M | M | Console warnings, contrast failures in the Playwright matrix | Finish TU-04 and TU-05; matrix on every change | developer | 0 |
| R-26 | One developer part-time is a single point of failure | technical | H | H | Throughput `v` below 4 work units per week; open decisions pile up | Small verified tasks, plans in the repository, defaults in DR | owner | all |
| R-27 | Cold start: supply without buyers or buyers without supply | market | H | M | Few published products; checkout rate near zero | Platform-seeded content, invited creators, payouts open only after a real purchase passes the refund window | owner | 2 |
| R-28 | Dev and prod differ (Celery subprocess in dev and a second worker in prod, defaults in compose) | technical | M | M | Duplicate workers, divergent behavior (VD VF-11) | One compose service for the worker in both environments | developer | 0 |
| R-29 | Learning-gain claims made without a control group | pedagogy | M | M | Marketing copy cites improvement before the pilot | Report effect size with its interval; no claim before D-19 data; copy guard review | owner | 5 |
| R-30 | Metrics exposed publicly leak operational data | security | M | L | Unauthenticated scrape of `/metrics` (VD VF-08) | Restrict to the internal network (D-17) | developer | 0 |

## 2. Heat map by stage

| Stage | Risks active | Highest |
|---|---|---|
| 0 | R-11, R-12, R-14, R-15, R-16, R-17, R-22, R-25, R-28, R-30 | R-11, R-12 |
| 1 | R-01, R-13, R-18 | R-13 |
| 2 | R-03, R-07, R-24, R-27 | R-03 |
| 3 | R-08, R-10, R-19, R-20 | R-10 |
| 4 | R-02, R-04, R-05, R-06, R-09 | R-04 |
| 5 | R-23, R-29 | R-23 |

## 3. Review rule

A risk is reviewed at each stage exit gate. A risk is closed only with a test, a drill record or a decision `ACCEPTED` in the register; a mitigation that exists only as a sentence stays open.
