# Play UI and Themed Gamification

> **Status**: `draft` · **Owner**: `web-lead` · **Last reviewed**: `2026-10-10`
>
> The default theme "Play" and the application skin built on it, the theme icon contract that carries the gamification presentation, the gamify rules stored as rows, and the landing page that sells what exists.

Decision source: [ADR-018](../decisions/ADR-018-play-ui-and-db-defined-gamify.md); rules: [08-gamification-and-theme.md](../strategy/08-gamification-and-theme.md) and [13-data-model-delta.md](../strategy/13-data-model-delta.md); findings: [dynamic-theme-audit.md](../01-audit/dynamic-theme-audit.md) (H-009), [gamification-audit.md](../01-audit/gamification-audit.md), [dynamic-ui-audit.md](../01-audit/dynamic-ui-audit.md). Ledger and rules: [reward-ledger.md](./reward-ledger.md). Tasks: [play-ui-plan.md](../plans/play-ui-plan.md).

---

## Purpose

Defines what changes in the theme contract, the seeded default theme and its icons, the application shell and components, the gamify rule tables and engines, the screens that show them, and the landing page. The learner facing look follows the owner's reference (Duolingo: chunky depth buttons, rounded cards, playful type, a path of lessons, streak and XP always visible); the landing page follows the second reference (Arcjet: near black field, a mono eyebrow, italic accent words, numbered sections, dark bordered cards, pill calls to action). Neither reference's artwork, mascot, wordmark or copy is used.

Out of scope, each with its reason:

| Not covered | Why |
|---|---|
| Quests and missions, a lives mechanic, sold freezes, a global board | strategy 08 §2, §3, §4 decided against them; they would reward activity or sell a streak |
| User created themes and the user preference endpoint | the owner asked for one seeded default first; the resolver gets the slot, the endpoint comes later |
| Spending stars | no shop is specified; stars are earned and shown only |
| Real money for any gamification item | not specified; minors are possible (D-02) |

## Research

Observed on 2026-10-10 in a browser, computed styles and screenshots only (the sites' text fetch carries no visual data).

| Source | Observation | What this design takes |
|---|---|---|
| Duolingo (id.duolingo.com) | white page, text `#4B4B4B`, rounded sans, headings 32 px bold; primary buttons 50 px high, radius 12, 4 px darker bottom edge, uppercase 15 px bold with 0.8 px tracking; secondary button white with a light border and a blue label; green `#58CC02`, blue `#1CB0F6`; illustration on the left of the hero, language chips with flags below | the button and card depth, the shape language, the colors as decoration, uppercase labels, an illustrated hero and a row of chips |
| Arcjet (arcjet.com) | body `#010203`, text `#827C8C`, headings white 56 px bold with -1.4 px tracking, accent words italic in a light violet, mono uppercase eyebrow ("RUNTIME SECURITY FOR AI AGENTS"), white pill buttons radius 13 to 20, sections numbered "01 – THE PROBLEM", cards `#0B0B0C`-like with hairline borders and glowing line art, a star field texture | a dark marketing skin with the same devices: eyebrow, numbered sections, italic accents, pill CTA, dark cards with line art |
| WCAG 2.2 (via the platform validator, `theme-validator.ts`) | body text 4.5:1, large text and UI 3:1 | the light scheme uses darker greens and blues for text and fills; bright brand colors are decoration |

Contrast computed for the palette below: white on `#2F7D00` 5.18, white on `#1D6FB8` 5.23, `#B85C00` on white 4.60, `#6B6B6B` on white 5.33, `#3C3C3C` on white 11.03, `#58CC02` on `#131F24` 8.05, `#0B2B00` on `#58CC02` 7.39.

## Current state

| # | Fact | Evidence |
|---|---|---|
| 1 | The theme stack is unconnected: `getDefaultTheme` has no caller, `useResolvedTheme` has no caller, the shell gets no props, `reducedMotion` is fixed to false | dynamic-theme-audit H-009 |
| 2 | `ThemeIcon` exists with `name` and `imageIcon`, no code reads it; `GET /themes/default` is public and returns no icons; names are not unique | `schema.prisma`, `themes.controller.ts`, `themes.repo.ts` |
| 3 | Achievement catalog empty, evaluator unwired, badge ids are constants | gamification-audit |
| 4 | Level thresholds are constants and the XP behind them is a count of active days | `level-calculation.service.ts` |
| 5 | Reward values are constants in `reward-rules.ts`, no `RewardRule` table | ADR-015 |
| 6 | Streak is credited by `ActivityDetectorInterceptor` on chat messages and step updates | `daily-activity.interceptor.ts` |
| 7 | The web pages `learn/(gamify)/{achievements,leaderboard,streaks,support}`, `learn/profile/{me,my-learning,settings}` are 62 to 77 byte stubs; `learn/profile/dashboard.vue` shows fixed numbers | `apps/web/app/pages` |
| 8 | The web build fails: `nuxt.config.ts` lists `~/assets/css/landing.css`, which does not exist | build log of 2026-10-10 |
| 9 | `User.stars` and `User.souls` have no writer and no rule | strategy 08 §4 |

## Theme contract v2

Required tokens (14) are unchanged. Added, optional per scheme: `success`, `danger`, `warning`, `info`, `gold`, `flame`, `primaryDepth`, `secondaryDepth`, `dangerDepth`, `goldDepth`. Optional `tokens.shape`: `{ radius: 6..24, depth: 0..6 }` in pixels. CSS variables: `--rc-success`, `--rc-danger`, `--rc-warning`, `--rc-info`, `--rc-gold`, `--rc-flame`, `--rc-primary-depth`, `--rc-secondary-depth`, `--rc-danger-depth`, `--rc-gold-depth`, `--rc-radius`, `--rc-depth`.

Palette of `reducera-play`:

| Token | Light | Dark |
|---|---|---|
| bg | `#FFFFFF` | `#131F24` |
| surface | `#FFFFFF` | `#1F2C33` |
| fg | `#3C3C3C` | `#F1F7FA` |
| muted | `#6B6B6B` | `#9FB0B8` |
| border | `#E5E5E5` | `#37464F` |
| borderStrong | `#8A8A8A` | `#6B7F89` |
| primary / primaryFg | `#2F7D00` / `#FFFFFF` | `#58CC02` / `#0B2B00` |
| secondary / secondaryFg | `#1D6FB8` / `#FFFFFF` | `#49C0F8` / `#06202E` |
| accent | `#B85C00` | `#FFB020` |
| focus | `#1D6FB8` | `#49C0F8` |
| foam (subtle fill) / sand (warm fill) | `#F7F7F7` / `#FFF4D6` | `#18262D` / `#3A3320` |
| success / danger / warning / info | `#58CC02` / `#D92D2D` / `#FF9600` / `#1CB0F6` | `#58CC02` / `#FF6B6B` / `#FFB020` / `#49C0F8` |
| gold / flame | `#FFC800` / `#FF9600` | `#FFC800` / `#FF9600` |
| depths: primary / secondary / danger / gold | `#1F5A00` / `#124F86` / `#A31F1F` / `#C79A00` | `#3E9A00` / `#2D8FC4` / `#C93D3D` / `#C79A00` |

Shape of `reducera-play`: radius 16, depth 4. The ocean theme keeps radius 8 and depth 0 (its defaults).

## Icons

Vocabulary: `streak`, `xp`, `star`, `level`, `badge`, `league`, `freeze`, `node`, `lock`, `trophy`. The component `GameIcon` takes a name, resolves the URL through the chain (theme chain, default theme, bundled `/themes/reducera-play/icons/<name>.svg`) and renders an `img` with an accessible name from a label table. A theme can override any subset. The default theme's ten SVGs are original, drawn on a 64 px grid with the theme's bright colors baked in.

## Gamify rows and engines

Schema (one migration):

| Change | Detail |
|---|---|
| `RewardKind` enum, `GamificationLedger.kind` | `XP` or `STAR`, default `XP`; the reversal trigger also compares `kind` |
| `RewardRule` | `code`, `version`, `eventType`, `rewardKind`, `amount`, `dailyCap`, `params` (Json), `active`, unique (`code`, `version`) |
| `LevelThreshold` | `level` (primary key), `xp` |
| `Achievement` | add `code` (unique), `rule` (Json), `iconName`, `sortOrder`, `active`; `condition` stays unused |
| `User` | add `timezone` (default `Asia/Jakarta`), `streakFreezes` (default 0), `lastStreakDate`, `leaderboardHandle` (unique, nullable), `leaderboardOptIn` (default false) |
| `ThemeIcon` | unique (`themeId`, `name`) enforced in the service (rows may already exist elsewhere) |
| `StreakHistory` | gains `activityType` value `LEARNING` used by the engine |

Seed catalog (values are proposals, D-25): `MASTERY_PROGRESS` v1 and `CONCEPT_PASSED` v1 as in ADR-015; `PATH_NODE_MASTERED` v1 pays 1 star when a sub-topic's concepts are all passed for the first time (once per node); `STREAK_FREEZE_EARNED` v1 grants one freeze per 7 consecutive qualified days, at most 2 held; `STREAK_BONUS_7` is kept inactive (decision D-22 keeps it open; with no activity credit it only pays on learning streaks, so it is seeded active as before).

Level thresholds: the thirteen rows of the current constants. Level is the highest level with `xp <=` ledger XP.

Achievement rule, typed: `{ "metric": M, "op": ">=", "value": N }` with `M` in `ASSESSMENTS_COMPLETED`, `CONCEPTS_PASSED`, `NODES_MASTERED`, `STREAK_DAYS`, `LEVEL`, `XP_TOTAL`. Seed catalog: first assessment (1), five assessments, first concept passed, five concepts passed, first node mastered, 3-day streak, 7-day streak, 30-day streak, level 5. Evaluation runs in the grading transaction after the reward engine and the streak engine, writes `UserAchievement` with a unique key, and is a no-op on repeat.

Streak engine: on a qualifying event (an assessment event appended with evidence), compute the learner's local date from `timezone`; if a `StreakHistory` row for that date exists, stop; otherwise count the previous day (a missed single day consumes a freeze if held, a longer gap resets), write the row, update `currentStreak`, `longestStreak`, `lastStreakDate`, grant a freeze on every 7th day through a ledger rule row. The interceptor no longer credits streaks.

Boards: `GET /gamify/leaderboards/topics/{topicId}?window=week` returns opted-in learners of that topic ordered by concepts first passed in the window, with handle and rank, plus the caller's own rank; `PUT /gamify/leaderboards/me` sets opt-in and handle (unique, 3 to 20 characters, lowercase letters, digits and underscore).

Reads: `GET /gamify/me` returns XP, level and progress to the next level, stars, streak, longest streak, freezes, week days; `GET /gamify/achievements/me` returns the catalog with unlocked state and progress; `GET /themes/default` returns the icons.

## Application shell and components

Layouts: the learner layout becomes a left rail on wide screens (Belajar, Latihan, Peringkat, Pencapaian, Profil, with theme icons) and a bottom tab bar under 768 px; a sticky stat bar shows streak, XP, level and stars from `GET /gamify/me`. Studio, admin, auth and public layouts take the same tokens and shapes.

Components (names in `components/play`): `PlayButton` (variants primary, secondary, danger, ghost; depth, uppercase label, pressed state), `PlayCard`, `PlayProgress`, `StatPill`, `GameIcon`, `LevelRing`, `StreakWeek`, `AchievementTile`, `RankRow`, `PathNode`. The existing `ActionButton`, `Modal`, `Toast`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `StatusBadge` take the depth and radius variables. Typography: Nunito (open license) self hosted for the application; Jost and Roboto Mono for the landing page. Motion respects `prefers-reduced-motion` and the resolver's motion budget.

## Landing page

Fixed dark skin, own fonts, `landing.css`. Sections: header with a pill CTA; hero with a mono eyebrow, a headline with italic accent words and two CTAs; a strip of what the platform grades; `01 – MASALAH` (four cards: login, chat, screen time, volume do not prove learning); `02 – CARA KERJA` (Amati, Nilai, Hargai: evidence, rules, ledger); `03 – GAMIFIKASI` (XP from mastery, a streak that cannot be farmed, freezes that are earned, achievements from rules in the database, opt-in boards per topic; each with its theme icon and a small live demo built from the default theme); `04 – TEMA` (the look comes from a theme row; a two chip toggle between Play and Samudra changes the demo); `05 – BUKTI` (facts that are true: 65 concepts, versioned rules, an append-only ledger); `06 – FAQ`; closing CTA; footer. Every claim must match a mechanism that exists and is tested.

## Trade-offs

| Choice | Alternative | Why |
|---|---|---|
| Light scheme with darker green | Duolingo's bright green with white text | fails the platform's own 4.5:1 rule (2.09:1) |
| Optional tokens added to the contract | New table or a second theme format | additive and backward compatible; older themes keep working |
| Icons by closed vocabulary | Free names | the UI can ask for a name and always get an image |
| Gamify values as rows | Constants | a tuning change must not need a deploy or rewrite history |
| Level from ledger XP | Active days | active days reward presence |
| Landing outside the theme chain | Landing themed per learner | a visitor has no learner state |

## Migration notes

Additive columns and tables; the seed script generalizes to several themes and to icons and rules. Rollback: images tagged before deploy; the migration only adds. The ledger reversal trigger is replaced in the same migration.

## Verification

Filled in as tasks complete.

## Evidence citations

- `docs/strategy/08-gamification-and-theme.md`, `13-data-model-delta.md`; `docs/01-audit/{dynamic-theme-audit,gamification-audit,dynamic-ui-audit}.md`
- `services/api/src/v1/gamify/**`, `services/api/prisma/{schema.prisma,seed-theme.ts}`, `apps/web/app/{theme,components,pages,layouts}`, `apps/web/nuxt.config.ts`
- Browser observation of id.duolingo.com and arcjet.com on 2026-10-10
