# Gamification and Dynamic Theme

> **Status**: `planned` · **Owner**: `product-architect` · **Last reviewed**: `2026-10-02`
>
> An event-driven reward engine that pays for verified learning and reviewed quality, never for activity alone, and a theme resolution order that changes presentation by level, progress and topic without touching grading.

Facts: [`01-verification-delta.md`](./01-verification-delta.md) (VD). Decisions: D-02 (minors), D-06 (credits), D-11 (theme inputs). Forbidden by the master prompt and kept here: rewards for logins, for content volume, or for any unverified event; a single circularity score; engagement metrics as success.

---

## 1. Reward engine

The request-driven engine is dormant (VD S-08): `ActivityDetectorInterceptor` is not registered, `StreakService.recordLearningEvent` has no caller, nothing writes `User.totalPoints`, `souls`, `stars` or the streak counters, and `Achievement` and `UserAchievement` have no writer. The replacement is an engine that consumes `LearningEvent` v2 and nothing else.

### 1.1 Reward rules

Amounts and caps are symbols; values come from the pilot (D-19) and the credit economics decision (D-06). `Minor` states the restriction when D-02 puts minors in scope.

| Event | Reward | Daily cap | Idempotency key | Anti-farming rule | Minor |
|---|---|---|---|---|---|
| `LessonCompletedAssessed` | XP `xp_L` | `cap_L` events | `reward:lesson:<userId>:<lessonId>` | Once per lesson; the quiz must be scored server side (AU-02); score at least `s_lesson` | allowed |
| `ScenarioPassed` (first pass of a scenario in `PRACTICE` or `CHALLENGE`) | XP `xp_S`, 1 star, credits `cr_S` | `cap_S` events, `cap_credit` credits | `reward:scenario:<userId>:<scenarioId>` | Once per scenario; engine-verified result; minimum elapsed time `T_min` between start and completion; replays pay 0 | XP and stars allowed; credits closed-loop, never cashable |
| `MisconceptionResolved` | XP `xp_M` | `cap_M` | `reward:misc:<userId>:<code>:<cycle>` | One payout per resolution cycle; at most one per code per `W_m` days | allowed |
| `PathNodeMastered` (mastery crosses `theta` for the first time on a node) | 1 star | none, bounded by graph size | `reward:node:<userId>:<subTopicId>` | Once per node ever | allowed |
| `ClassCompleted` | XP `xp_C` | `cap_C` | `reward:class:<userId>:<classId>` | Attendance confirmed by a verified session record in at least `a_min` sessions; a creator cannot earn on an enrollment in their own class | allowed |
| `ProductApprovedFirstTime` (creator) | XP `xp_P` weighted by rubric score | `cap_P` per month | `reward:product:<productId>:<version>` | Only after reviewer approval; no reward for rejected or withdrawn items; reversed by a ledger entry if the product is suspended within `W_s` days | no creator role for minors |
| `ProductOutcomeSignal` (creator, monthly) | XP proportional to mean mastery gain of buyers, capped | `cap_O` per month | `reward:outcome:<productId>:<month>` | At least `n_min` distinct buyers; refunded orders excluded; no reward by content volume | no creator role for minors |
| `ReviewCompleted` (reviewer) | XP `xp_R` | `cap_R` | `reward:review:<reviewItemId>` | Only when agreement with a second reviewer on a sampled item is at least `a_agree`; no self-review | none |
| `StreakDayQualified` | streak counter only | one per local day | `streak:<userId>:<localDate>` | Needs at least one qualifying event above; logins, page views, chat messages never qualify | allowed |

Every reward is a row in the ledger (§5) written in the same transaction as the event it pays; a duplicate idempotency key is a no-op. Rules are versioned rows (`RewardRule`), so a changed amount never rewrites history.

### 1.2 XP sources in one view

| Source | What is measured | Why not volume |
|---|---|---|
| Lessons completed with assessment | Server-scored quiz result | A completion without an assessed result pays nothing |
| Scenarios passed | Engine score at least `s_pass` | The engine, not the learner, declares the pass |
| Teaching others | Mean mastery gain of buyers on linked sub-topics | Paid in proportion to outcomes of at least `n_min` buyers |
| Content created | Reviewer approval and rubric score | Ten rejected articles pay less than zero approved ones |

---

## 2. Streak

A streak day is a local calendar day with at least one qualifying learning event from §1.1. Never from logins.

| Rule | Value |
|---|---|
| Day boundary | The user's stored time zone, default `Asia/Jakarta` [ASSUMPTION]; the field does not exist on `User` today |
| Freeze | One freeze is earned per `W_f` consecutive qualified days, at most `F_max` held; a missed day consumes one freeze automatically; with none, the current streak resets and the longest streak stays |
| Purchase | Freezes are not sold [ASSUMPTION: avoids paying to keep a streak] |
| Source of truth | `StreakHistory` (exists, unique per user and date) written only by the engine; `User.currentStreak`, `longestStreak`, `lastStreakDate` become projections |

---

## 3. Skill tree and leaderboards

The skill tree is the prerequisite graph with a mastery overlay (`06-accounting-domain.md` §1, `07-ai-architecture.md` §3.4); nothing else defines the tree. Node states: locked (a prerequisite below `theta`), available, in progress, mastered.

Leaderboards:

| Property | Rule |
|---|---|
| Opt-in | Off by default; a learner joins a board explicitly |
| Scope | Cohort (a class or an invited group) or topic; no global board |
| Ranked quantity | Nodes mastered and scenarios passed in the window, not XP totals, so volume farming does not move a rank |
| Identity | Handle only; no real name unless the learner chooses it |
| Minors | Never public; private group boards only (D-02) |
| Storage | `LeaderboardScore` exists and is read by two routes; nothing fills it today; the engine fills it |

---

## 4. Existing schema and what changes

| Table or column | State | Change |
|---|---|---|
| `User.totalPoints`, `souls`, `stars`, `currentStreak`, `longestStreak`, `lastStreakDate` | counters, no writer | Become projections of the ledger; columns stay until cutover |
| `StreakHistory`, `DailyActivityLog`, `LeaderboardScore`, `Achievement`, `UserAchievement`, `DailyStats` | tables; first three have `ADMIN`-only writers, last three none | `StreakHistory` and `LeaderboardScore` written by the engine; `Achievement` through reward rules; `DailyStats` stays unused (dead schema) |
| `Universe`, `World`, `QuestDefinition`, `UserQuest` | do not exist | Not built: the loop does not need quests; reduces scope [ASSUMPTION: no quest requirement in the master prompt's loop] |
| `RewardRule`, `GamificationLedger`, `UserUniverseState` | do not exist | New (`13-data-model-delta.md`) |
| `User.souls` (lives, default 5) | no writer, no rule | Out of scope; decision needed before it appears in UI |

---

## 5. Ledger

`GamificationLedger` is append-only (same `forbid_row_mutation` pattern as `LedgerTransaction` and `AICreditLedgerEntry`): one row per reward with `userId`, `kind` (`XP`, `STAR`, `CREDIT_EARN_REF`), `delta`, `ruleId`, `ruleVersion`, `eventId`, unique `idempotencyKey`. `UserUniverseState` is the projection (XP, stars, level, streak, best streak, freezes) updated in the same transaction. A credit reward writes the `GamificationLedger` row and calls the credit service with the same key, so the credit ledger and the reward ledger can be reconciled by key. Reversal is a negative row referencing the original, never an update.

---

## 6. Dynamic theme (D-11)

### 6.1 Inputs

| Input | Allowed | Effect |
|---|---|---|
| Level (skill-tree level of the current node) | yes | Density and illustration only: Beginner uses friendly density with the illustration, Advanced uses professional density without it |
| Progress (mastery in the topic) | yes | A `MasteryMeter` using `--rc-*` tokens; no color change outside the token set |
| Topic | yes | `Topic.themeId` chooses the theme |
| Personality | no | No personality-driven UI |
| Accessibility (reduced motion, forced colors) | always | Overrides everything |

### 6.2 Resolution order

User preference theme (a published theme that passes the validator) first, then the content chain (step, lesson, sub-topic, topic) as `useResolvedTheme` already orders it, then the level variant of the default theme, then the default `reducera-ocean`. The existing resolver takes `chain`, `variant` (`LEARN`, `PRACTICE`, `CHALLENGE`, `EXAM`), `scheme`, `reducedMotion` and `fallback`; it has no user preference and no level input [VERIFIED: `apps/web/app/theme/resolve.ts:12-20`, `composables/useResolvedTheme.ts:5-14`]. Additions: an optional first chain entry for the user theme, and `data-rc-density` set from the level. Theme presentation never alters grading, mastery or sandbox validation (V1 plan golden tests 9 and 10).

### 6.3 Constraints that already exist

| Constraint | Evidence |
|---|---|
| Every theme passes `validateForPublish`: body text contrast at least 4.5:1, large text and UI at least 3:1 | `theme-validator.ts:12-14` |
| Lifecycle by intent endpoints, `ADMIN` only: `submit-review`, `publish`, `suspend`, `archive`, `set-default` | `themes.controller.ts:114-157` |
| Asset URLs restricted by policy (https, allow-listed hosts, no private ranges) | `theme-asset-policy.ts` |
| Atmosphere is CSS only; the hero stays under 4 KB and decorative CSS under 6 KB gzip; off under `prefers-reduced-motion`, in `EXAM`, and under forced colors | [DOC-ONLY: V1 plan §7.4] |
| The default theme renders from static CSS when the API is unreachable | `main.css` tokens, `server/utils/theme.ts` |

### 6.4 Gaps to close

| Gap | Where | Stage |
|---|---|---|
| Finish `ThemeBackground`, `ThemeWorldCard`, and the raw `theme?.primary` consumers (TU-04, TU-05) | web | 0 |
| `ETag` and `Cache-Control` on `GET /gamify/themes/default` (TT-06) | api | 0 |
| User theme preference field and endpoint | api, web | 5 |
| Admin theme preview and publish page (TG-04) | web | 5 |
| Level variant (`data-rc-density`) | web | 1 |

---

## 7. Acceptance tests

| ID | Test | Stage |
|---|---|---|
| GM-01 | Reward once: the same event delivered twice writes one ledger row | 4 |
| GM-02 | No farming: replaying a passed scenario pays 0; completion faster than `T_min` pays 0 | 4 |
| GM-03 | A login or a chat message never qualifies a streak day | 4 |
| GM-04 | A missed day consumes a freeze; with none the streak resets and the best streak stays | 4 |
| GM-05 | A creator reward is withheld for a rejected product and reversed on suspension | 4 |
| GM-06 | Leaderboard rows exist only for opted-in users; a minor never appears on a public board | 4 |
| GM-07 | Ledger projection: `UserUniverseState` equals the sum of the ledger after a random replay | 4 |
| TH-01 | Theme resolution golden tests with a user theme, a topic theme, a level variant and the default | 1 |
| TH-02 | Reduced motion: no running animation inside `[data-rc-theme]` | 1 |
| TH-03 | An unpublished or failing theme never resolves; the default renders | 1 |

## 8. Trade-offs

| Choice | Alternative | Why |
|---|---|---|
| Ranked quantity is mastery and passes | XP totals | XP totals reward volume |
| Rules as versioned rows | Constants in code | A tuning change must not rewrite history |
| No quests | Universe, World, Quest tables from the audit | None of the loop's arrows needs them; they cost a UI and an authoring tool |
