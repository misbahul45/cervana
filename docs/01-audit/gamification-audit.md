# Gamification Audit — Reward Authority, Ledger, Anti-Farming

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-09`
>
> Who grants rewards, whether grants are idempotent and auditable, and whether any reward depends on learning evidence.

---

## Scope

The api gamify module (streaks, daily logs, leaderboards, levels, badges, themes), the places that grant points, the ai-api `gamification` package, and the web components that present rewards. Creator earnings and wallets are money flows covered by the payment and ledger code and are not audited here. The target flow is LearningEvent → RewardEngine → GamificationLedger → projection → AI narration.

## Findings

### Authority and flow

| Component | Status | Source | Notes |
|---|---|---|---|
| Reward authority is the api, not the AI | `IMPLEMENTED` | all reward writes are in `services/api/src/v1/gamify` and `.../learning/user-steps/user-steps.repo.ts`; ai-api has no reward write | the ai-api `gamification` package is unreachable and has no I/O |
| `GamificationLedger` (append-only, idempotency key, rule id and version, compensating reversal) | `MISSING` | no model, table, trigger or code of that name; `AGENTS.md` lists it among protected tables | see System audit, claims table |
| Reward rules (`RewardRule`, versions, eligibility) | `MISSING` in the api | constants are inline: 10 points per step, 50 points per 7-day streak, `LEVEL_THRESHOLDS`, badge ids | ai-api `RewardRule`/`RewardEngineSimulator` (`services/ai-api/v1/gamification/engine.py:14-110`) is a simulator, unreachable |
| Reward engine consuming learning events | `MISSING` | `LearningEvent` has no writer (H-006) | |
| Points | `PARTIAL` | `services/api/src/v1/learning/user-steps/user-steps.repo.ts` `complete` | see H-008 |
| Streak | `PARTIAL` | `services/api/src/v1/gamify/streaks/streaks.repo.ts:136-170`; trigger `services/api/src/common/interceptors/daily-activity.interceptor.ts:27-56` | see H-008 |
| Level | `PARTIAL` | `services/api/src/v1/gamify/level/level-calculation.service.ts:5-37`; XP source `level-calculation.module.ts:17-21` | XP = number of daily-activity rows × 10 (capped at 999 rows), so level measures active days, not learning |
| Leaderboard | `PARTIAL` | `services/api/src/v1/gamify/leaderboards/`; scopes GLOBAL, TOPIC, SUBTOPIC, synthetic row ids `g-<user>`, `t-<user>-<topic>`, `st-<user>-<subtopic>` | increments only; no history |
| Badges | `UNWIRED` | `services/api/src/v1/gamify/badges/badge-issuance.service.ts:8-60` defines 4 badge ids (`badge-first-step`, `badge-streak-7`, `badge-journal-keeper`, `badge-trial-balance-hero`) and their rules; controller exposes only `GET /badges/me` | `BadgeIssuanceService.evaluate` has no caller outside the badges folder; nothing creates `Achievement` rows (`schema.prisma:697`, no create, no seed, no migration insert), so `awardIfMissing` (`badge-issuance.repo.ts:7-19`) would fail on the foreign key if it were called |
| Achievements, missions, creator progression | `MISSING` | | |
| AI narration | `UNWIRED` | `services/ai-api/v1/gamification/narration.py` (canonical phrases), `boundary.py` (forbidden routes) | no caller; useful as a design reference only |
| Web presentation | `PARTIAL` | `apps/web/app/components/gamification/{BadgeGrid,LevelBadge,SkillTreeLeaf,RewardToast,BadgeToast}.vue`; `components/learn/StreakIndicator.vue` | intensity is not configurable; 0 web tests |

### H-008

**Rewards do not depend on learning evidence and the main grant is repeatable.**

| Vector | Evidence | Effect |
|---|---|---|
| Step completion grants points on a bare POST | `POST /user-steps/complete/:id` is guarded by ownership only (`user-steps.controller.ts:48-55`). `UserStepsService.complete` calls the repo (`user-steps.service.ts:99-101`). The repo sets `isDone: true`, unlocks the next step, then upserts three leaderboard rows with `increment` of `pointValue = 10` (`user-steps.repo.ts`, `complete`, `pointValue` at the line after the topic lookup). It does not read `isDone` first, requires no quiz or practice result and takes no idempotency key | each repeated call adds 10 to GLOBAL, TOPIC and SUBTOPIC. Read statically; the endpoint was not called |
| Streak credited by chat messages | `ActivityDetectorInterceptor` runs after any successful handler it decorates and records `DAILY_LOGIN` (`daily-activity.interceptor.ts:27-56`). It decorates `POST chat-messages` (`chat-messages.controller.ts:24`), quiz-attempt routes, and the user-step create/update/complete routes | a chat message, with no learning outcome, credits the daily streak. Every 7th consecutive day then adds 50 points (`streaks.repo.ts:160-162`) |
| Level from active days | `level-calculation.module.ts:17-21` | level rises with days of activity |
| Check-then-create race | `detect` does `findToday` then `create` then `incrementOrReset` without a lock (`daily-activity.interceptor.ts:27-40`); `incrementOrReset` repeats the lookup | concurrent requests on the first activity of a day can double-count; `UNVERIFIED` (no concurrency test) |
| Missing duplicate protection and reversal | no event id, rule id, rule version or idempotency key on any grant; no compensating entry mechanism | grants cannot be audited, deduplicated or reversed |

The specification forbids rewarding login, page views, chat messages, clicks and time on site without verified learning. The streak and level paths do reward activity alone.

Tests: 10 gamify specs pass (streak, level, leaderboards, themes); none asserts that a repeated completion is a no-op or that a chat message earns nothing.

### Python package

`services/ai-api/v1/gamification/` (5 modules, 437 lines, 22 tests) holds a rule-based reward simulator with rule cooldowns (`engine.py:91`), canonical celebration phrases (`narration.py:20,59`) and a boundary list of routes the AI must not call (`boundary.py`). It performs no persistence and no network calls and is imported by no production module.

## Evidence citations

- `services/api/src/v1/gamify/{streaks/streaks.repo.ts:136-170,level/*,badges/*,leaderboards/*}`
- `services/api/src/v1/learning/user-steps/{user-steps.controller.ts:48-55,user-steps.service.ts:99-118,user-steps.repo.ts}`
- `services/api/src/common/interceptors/daily-activity.interceptor.ts:27-56`; `services/api/src/v1/chat/chat-messages/chat-messages.controller.ts:24`
- `services/api/prisma/schema.prisma:697` (`Achievement`); migrations `20260930040500_domain_foundation/migration.sql:653-661` (append-only triggers, none for gamification)
- `services/ai-api/v1/gamification/{engine,narration,boundary,types}.py`
- Web: `apps/web/app/components/gamification/`, `apps/web/app/components/learn/StreakIndicator.vue`

## Verdict

The api owns rewards, as required, but it grants them from activity, not from verified learning, with fixed constants, no rule versions, no ledger, no idempotency and no reversal. One grant (step completion) is repeatable by the owner. Badges cannot be issued at all because the achievement catalog is empty and nothing calls the evaluator. The ai-api gamification package is a sound design sketch with no connection to any running code. The dynamic, learning-driven gamification in the target (recovery missions, boss challenges, creator missions) has no foundation yet: it needs the learning-event store and a ledger first.
