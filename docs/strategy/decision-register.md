# Decision Register

> **Status**: `planned` · **Owner**: `owner` · **Last reviewed**: `2026-10-02`
>
> Every owner decision the strategy depends on, with the default the plan assumes; all entries are `PROPOSED` and none is accepted, so no ADR is written yet.

The plan never blocks on an open decision: it uses the recommended default and lists what that default unblocks. When the owner accepts a decision, the status changes to `ACCEPTED`, an ADR is written in `docs/decisions/`, and the `Last reviewed` date changes. Facts come from [`01-verification-delta.md`](./01-verification-delta.md).

Placeholders left empty by the owner; the plan uses these labeled assumptions:

| Placeholder | Value used | Tag |
|---|---|---|
| `[TEAM_CAPACITY]` | One developer, part-time, about 15 hours per week, with an AI coding agent executing small verified tasks; `git shortlog -sn --all` shows two committers with 8 commits each | [ASSUMPTION: repository history shows no larger team] |
| `[LAUNCH_TARGET_DATE]` | First public pilot, no date set; the roadmap gives durations in weeks of that capacity (`14-roadmap.md`) | [ASSUMPTION: no date supplied] |
| `[BUDGET_LLM_MONTHLY_IDR]` | Symbol `B_llm`; unit-economics tables carry it as a parameter, never as a number | [ASSUMPTION: no ceiling supplied] |

---

## 1. Register

| ID | Question | Options | Recommended default | Status | Unblocks | Needed by |
|---|---|---|---|---|---|---|
| D-01 | Launch segment | A university-first; B SMA-first; C both from day one | A: university accounting students are learners and creators; SMA is a later segment, gated by D-02 | PROPOSED, owner-confirm first | Copy, onboarding, content scope, D-02 | Stage 1 |
| D-02 | Minors (under 18) | Exclude; learning only; learning and purchase with guardian | If SMA enters scope: age gate; guardian consent for children's personal data under UU PDP No. 27/2022 (legal review required); no wallet, payout, creator role or public leaderboard for minors | PROPOSED, depends on D-01 | Signup, payments, gamification, privacy | Stage 1 (only if D-01 is B or C) |
| D-03 | Credential naming under the copy guard | "Lencana Keahlian"; "Portofolio Terverifikasi"; other | Evidence-based badges plus a verified portfolio; never claim official certification | PROPOSED | Credential feature, copy | Stage 7 |
| D-04 | Creator eligibility | Mastery threshold only; application and review; both | Application with evidence (mastery records, sandbox scores, academic proof) plus human review; mastery is an input, not the gate. Public name "Jadi Kreator"; role enum unchanged (K-10) | PROPOSED | Creator journey, `/become-creator` | Stage 2 |
| D-05 | Money policy | Fee percent, holding period, refund window, partial refunds | Fee 10 percent (code default `PLATFORM_FEE_PERCENT`); `CREATOR_EARNING_HOLD_DAYS` at least `REFUND_WINDOW_DAYS` (7); full refunds only (code already refunds the full intent amount). Live conflict: hold defaults to 0 today (HC-13) | PROPOSED, owner-confirm first | Wallet, payout, refund, stage 3 | Stage 3 (before any real payout) |
| D-06 | AI credit economics | Credit unit, package prices, expiry, earn caps | Integer credits; price per credit at least measured LLM cost per credit times margin `m`; daily earn caps; closed-loop, never cashable (legal review required) | PROPOSED | Credits, tutor UX | Stage 4 |
| D-07 | Wallet scope and reinvest | Per tenant; per creator user; both | One wallet per creator user within a tenant (implemented: unique `(ownerId, tenantId, currency)`); reinvest only by buying credits or products through the order pipeline via a `WALLET` payment adapter, never by direct balance transfer | PROPOSED; scope part already in schema | Data delta, finance | Stage 3 |
| D-08 | Mastery model | Elo-like; BKT; IRT | Elo-like with corrected formula and golden-vector tests that assert magnitudes (VF-02); `learner-state.md` does not exist | PROPOSED, owner-confirm first | Learner model, adaptive policy | Stage 1 |
| D-09 | Agent marketplace timing | Early; after the safety stack | After tool registry, sandbox runtime, evaluation harness and incident handling exist; status spelling `VALIDATING` (K-07) | PROPOSED | Roadmap stage 7 | Stage 7 |
| D-10 | Self-improvement scope | DSPy now; later | No optimizer until episodes, a frozen benchmark of at least 50 scenarios and measured judge agreement exist; promotion always human | PROPOSED | AI roadmap stage 6 | Stage 6 |
| D-11 | Dynamic theme inputs | Level, progress, topic, personality | Level, progress and topic only; every theme passes `validateForPublish`; no personality-driven UI | PROPOSED | Theme plan | Stage 1 |
| D-12 | Reviewer actor | New global role; capability flag; tenant role | A reviewer capability granted by `ADMIN`, so the `Role` enum stays stable (today only `ADMIN` moderates: K-09) | PROPOSED, owner-confirm first | Content quality gate, stage 2 | Stage 2 |
| D-13 | Browser to ai-api calls | Keep direct; proxy through api | Route every credit-spending AI call through `api` (reserve, call, settle); direct calls only for free, rate-limited reads. Needed because `ai-api` does not validate three of four routes (VF-07) | PROPOSED, owner-confirm first | AI and API plans, ADR-007 | Stage 4 (stage 0 for the VF-07 fixes) |
| D-14 | Payment gateway | Manual only; add a gateway | Manual for V1; a gateway adapter when volume justifies it (abstraction exists, webhook answers `501`) | PROPOSED | Checkout UX | Stage 3 |
| D-15 | Accounting standard profile | General; IFRS; local | General plus a local SAK-based educational profile as a field on scenarios; visible disclaimer | PROPOSED | Scenario authoring | Stage 1 |
| D-16 | Topic versus course product | Keep `Topic` sellable; stop selling `Topic`; new `Course` bundle | `Topic` stays the curriculum path and is no longer a marketplace product after a dual-read migration; paid courses are `ClassProduct` (format `RECORDED` or `LIVE`) and `Article`; a `CourseBundle` table only if data shows demand | PROPOSED | S-19 legacy path removal, data delta | Stage 2 |
| D-17 | Operational endpoint exposure | Keep `/metrics` and Swagger public; restrict | `/metrics` reachable only on the internal network (nginx deny or separate port); Swagger public only in dev | PROPOSED | VF-08 fix | Stage 0 |
| D-18 | Sandbox scenario authorship in V1 | Platform only; creators; both | Platform-seeded scenarios until the reviewer queue (D-12) and engine validation exist; creators author in stage 5 | PROPOSED | Sandbox content plan | Stage 1 |
| D-19 | Pilot cohort and learning-gain protocol | None; one class; several | One university accounting class, a pre test and a post test on the same sandbox scenarios, results reported as effect size with its interval; no engagement metric counts | PROPOSED | Stage 5 exit gate, KPI baselines | Stage 5 |
| D-20 | Real-money readiness gate | Ship; gate | Before the first payout: restore drill of Postgres and Qdrant backups, hold at least refund window, two distinct admin accounts (one approves payments, another approves payouts) | PROPOSED | Stage 3 exit | Stage 3 |
| D-21 | LLM spend ceiling `B_llm` | Fixed monthly cap; per-learner cap; both | Both: a monthly cap enforced by `ai-api` budgets and a per-learner daily cap; values owner-supplied | PROPOSED | Unit economics, stage 4 budgets | Stage 4 |

---

## 2. Conflicts the owner resolves first

| Conflict | Sources | Effect if left open |
|---|---|---|
| Segment: university-only (repo copy, copy guard, V1 plan §6) versus a generic platform with minors in scope (owner note of 2026-09-30) | `apps/web/nuxt.config.ts:7-8`, `copy.test.ts:11-22` against [DOC-ONLY: auto-memory `reducera-product-direction`] | The plan assumes D-01 A. If the owner chooses B or C, D-02 becomes a blocking stage 1 item and the copy guard bans "siswa", which a school segment needs |
| Hold days default 0 versus refund window 7 | `commerce.config.ts:13-34`, `commerce-fulfillment.service.ts:66` | Creators can withdraw before the refund window closes; a later refund fails with `409` (`commerce-refund.service.ts:61`) |
| `AGENTS.md` rule 5 (forward the user token) versus ADR-007 (signed identity) | `AGENTS.md` "Cross-service rules" 5, `ADR-007` | `AGENTS.md` is not edited by this plan; D-13 depends on the amendment |

## 3. Decisions the owner makes first

| Order | ID | Why first |
|---|---|---|
| 1 | D-01 | Gates copy, onboarding, D-02 and the content scope of stage 1 |
| 2 | D-08 | The learning core (stage 1) cannot ship on the current formula (VF-02) |
| 3 | D-05 | A live default allows withdrawal before the refund window; stage 3 depends on it |
| 4 | D-12 | Creator supply (stage 2) has no reviewer other than `ADMIN` |
| 5 | D-13 | Stage 0 fixes for VF-07 and stage 4 credit flow use the same path |

## 4. Change log

| Date | Change |
|---|---|
| 2026-10-02 | Register created with D-01 to D-15 from the master prompt and D-16 to D-21 from the verification delta |
