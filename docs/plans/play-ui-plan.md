# Play UI and Themed Gamification — Implementation Plan

> **Status**: `draft` · **Owner**: `web-lead` · **Last reviewed**: `2026-10-10`
>
> Ordered tasks that seed the default theme and its icons, connect the theme stack, restyle the application, store the gamify rules as rows, show them in complete screens and rebuild the landing page.

Design: [play-ui-and-themed-gamify.md](../architecture/play-ui-and-themed-gamify.md). Decision: [ADR-018](../decisions/ADR-018-play-ui-and-db-defined-gamify.md). Closes H-009 (dynamic theming not connected), the empty achievement catalog and unwired evaluator, the level from active days and the chat credited streak of H-008, and the empty gamify screens.

---

## Objective

After this plan a fresh database has one default theme with its icons and the gamify rules, the web renders the default theme from the database with the API down falling back to the bundle, every learner screen uses one skin, the streak, XP, level, stars, achievements and topic boards come from rule rows and verified learning, and the landing page presents exactly those mechanisms.

## Scope

| Area | Created | Edited |
|---|---|---|
| `services/api` | migration `20261010200000_play_theme_and_gamify_rules`, `gamify/rules/*`, `gamify/streaks/streak-engine.service.ts`, `gamify/achievements/*`, `gamify/me/*`, `gamify/leaderboards/topic-board.*`, seeds, specs | `themes.*` (icons in default, unique name), `theme.schema.ts`, `theme-validator.ts`, `reward-*`, `level-calculation.*`, `daily-activity.interceptor.ts` use, quiz attempts service, `schema.prisma`, authorization matrix |
| `apps/web` | `components/play/*`, `composables/useGameIcon.ts`, `server/utils/theme` callers, icon SVGs, fonts, `assets/css/{play,landing}.css`, landing components, gamify pages, specs | `theme/*`, `nuxt.config.ts`, `app.vue`, layouts, `components/ui/*`, pages |
| repo | `infra/scripts/check-theme-sync.sh` (two files), gate tests | `AGENTS.md`, tracker, decision register, memory |

Rules for every task: no comments in code or configuration; never `git add`, `commit` or `push`; failing test first; database specs only on `reducera_ls_scratch` exporting only `TEST_DATABASE_URL`; recreate compose services with `--no-deps`; the web image needs `pnpm build` on the host first (the Dockerfile copies `.output`); verify web in a browser at 375, 768 and 1280, light and dark, reduced motion, zero console errors.

Baselines before this plan (2026-10-10): api `jest` 1665 passed and 5 skipped with the scratch database; ai-api `pytest` 763 passed; web `vitest` 179 passed; ownership gate PASS; the web build fails on a missing `landing.css`.

## Step-by-step

| ID | Task | Verify |
|---|---|---|
| PU-01 | Theme contract v2 in api (`theme.schema.ts`, validator keeps its pairs, optional hex keys, `shape`) and web (`types`, `normalize`, `css-vars`). Specs first: old themes still normalize, optional keys validate and merge, shape bounds | api `jest src/v1/gamify/themes`, web `vitest app/theme` |
| PU-02 | Default theme `reducera-play` JSON (both copies), `reducera-ocean` kept, `check-theme-sync.sh` covers both, validator passes both schemes | `bash infra/scripts/check-theme-sync.sh`, spec that runs `validateForPublish` on the bundled JSON |
| PU-03 | Icon vocabulary (shared list), ten original SVGs, `ThemeIcon` unique name in the service, `GET /themes/default` returns icons, seed of theme and icons (generalized `seed-theme.ts`). Specs first | api specs, seed run on the scratch database, count of rows |
| PU-04 | Web theme connection (H-009): server fetch of the default theme with timeout and bundle fallback, `ThemeShell` receives the chain and the resolved variables, `reducedMotion` from the media query, `useGameIcon` and `GameIcon`. Specs first for the pure parts | web `vitest`, SSR HTML contains `data-rc-theme="reducera-play"` and the icon URLs |
| PU-05 | Fonts and `play.css`: Nunito files and licence, tokens to variables, depth, radius, focus ring, reduced motion; fixes the build (`landing.css` created by LP-01) | `pnpm build` |
| SH-01 | Components `components/play/*` with specs for their pure logic (variant to class, progress clamp, rank formatting) | web `vitest` |
| SH-02 | Layouts: learner rail and bottom tabs, stat bar, auth, public, studio, admin on the new tokens | browser matrix |
| SH-03 | Restyle `components/ui/*` and shared pieces (`Header`, `Footer`, forms, tables, toasts) | browser matrix |
| GB-01 | Migration and Prisma: `RewardKind`, ledger `kind` and trigger, `RewardRule`, `LevelThreshold`, achievement columns, user columns. Schema integration spec first | scratch database spec, empty `migrate diff` |
| GB-02 | Rules from rows: the reward engine reads active `RewardRule` rows (cached per request), the constants become the seed; parity spec proves the same grants for the ADR-015 fixtures | existing reward specs unchanged plus new ones |
| GB-03 | Level from ledger XP and `LevelThreshold`; `GET /gamify/me`. Specs first | api specs, integration spec |
| GB-04 | Streak engine (qualifying event, timezone, freeze earned and consumed, longest streak), interceptor no longer credits chat or step edits; GM-03 and GM-04 specs first | api specs, integration spec |
| GB-05 | Stars: `PATH_NODE_MASTERED` rule, projection to `User.stars` in the same transaction, GM-07 replay spec | integration spec |
| GB-06 | Achievements: seed catalog, typed rule evaluator, `GET /gamify/achievements/me`, wired into grading. Specs first | api specs, integration spec |
| GB-07 | Boards: opt-in and handle, topic board by concepts passed in the week, own rank. Specs first | api specs |
| GB-08 | Access decisions, authorization matrix, ownership gates for the new writers, deploy `api`, live checks with fixtures | route-access spec, gate, live |
| GU-01 | Stat bar and HUD data (`useGamify`), reward and level-up toasts from real ledger entries | browser |
| GU-02 | Screens: `learn/(gamify)/{streaks,achievements,leaderboard}`, profile (`me`, settings with board opt-in), learn home with the lesson path and next concept | browser matrix |
| LP-01 | `landing.css`, landing fonts, landing components and sections, copy, demo, theme toggle chips; keep `app/landing/*` logic that still applies | browser matrix, `pnpm build`, `vitest` |
| PG-01 | Remaining pages onto the shell and tokens in batches (learn, my-learning, onboarding, sandbox, simulator, tutor, wallet, credits, marketplace, creators, career, review, notifications, profile) with real data where a mock stands (`learn/profile/dashboard.vue`) | browser matrix per batch |
| PG-02 | Studio, teacher, admin, reviewer pages | browser matrix per batch |
| CL-01 | Docs, `AGENTS.md`, tracker RC-19, decisions D-24 and D-25, memory; full suites, gates, deploy, report | checks of the list |

## Acceptance criteria

1. A fresh database after migrate and seed has the Play theme as default with ten icons, the reward rules, the level thresholds and the achievement catalog.
2. The served HTML carries the default theme and icons, and renders with the API stopped.
3. A chat message never extends a streak; a graded assessment does once per local day; a missed day consumes a freeze or resets; replay of the ledger equals the projections (GM-03, GM-04, GM-07).
4. Level follows ledger XP; an achievement unlocks once; a board shows only opted-in learners by handle.
5. Every page named in the plan renders in the Play skin at three widths, both schemes, with zero console errors; the empty gamify screens show real data.
6. The landing page builds, uses only claims backed by a mechanism, and renders at three widths with zero console errors.
7. Suites pass, gates pass, the stack is healthy and the logs are clean.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| the scope is large | High | tasks ship one at a time, each verified; pages move in batches |
| the ledger trigger change breaks reversals | High | integration spec of the reversal trigger before and after |
| streak behavior change surprises learners | Medium | recorded as D-25 proposal; counters stay as projections |
| contrast failures in the new theme | Medium | the bundled JSON is checked by the publish validator in a spec |
| web build depends on host state | Medium | `pnpm build` before every web image; the failing import is removed first |
| large visual regressions | Medium | browser matrix per batch with screenshots |

## Rollback

- Images before this plan: `reducera-api:pre-play-20261010` and `reducera-web:pre-play-20261010`; dump of the dev database.
- The migration only adds; the ledger trigger is restored from the previous migration if needed.

## Progress

| ID | State | Evidence |
|---|---|---|
| PU-01 | [x] | theme contract v2 in api and web; `theme.spec`, `normalize`, `css-vars` specs; old themes still normalize |
| PU-02 | [x] | `reducera-play` JSON in both copies, `reducera-ocean` kept; `bash infra/scripts/check-theme-sync.sh` covers both; contrast checked by `palette-doc.spec` |
| PU-03 | [x] | ten original SVGs, unique icon name per theme (409), `GET /gamify/themes/default` public and live with icons; `seed:theme` run on the dev database |
| PU-04 | [x] | `/_rc/theme/default` Nitro route, plugin, `ThemeShell` chain; SSR HTML names `reducera-play`; dark palette rendered as a `.dark` stylesheet so hydration matches (`shellRender`) |
| PU-05 | [x] | Nunito, Jost, Roboto Mono bundled with licences; `play.css`, `landing.css`; `pnpm build` passes |
| SH-01 | [x] | `components/play/*` with `lib/play` specs |
| SH-02 | [~] | learner and learn shells (rail, HUD, bottom tabs), landing, auth (split layout) and learning layouts are done; public, admin and studio layouts are still the old ones |
| SH-03 | [x] | `components/ui/{EmptyState,ErrorState,StatusBadge,Toast,Modal,ConfirmDialog,LoadingSkeleton,ActionButton,RenderMarkdown}` on tokens |
| GB-01 | [x] | migration `20261010200000_play_theme_and_gamify_rules` applied to the dev and scratch databases; integration specs |
| GB-02 | [x] | rules from `RewardRule` rows with parity specs |
| GB-03 | [x] | `GET /gamify/me`, level from ledger XP; live check on the dev stack |
| GB-04 | [x] | `StreakEngineService`, interceptor no longer credits streaks; live check, one extension per day |
| GB-05 | [x] | `PATH_NODE_MASTERED` stars projected in the grading transaction; live check |
| GB-06 | [x] | 11 achievements, typed evaluator, `GET /gamify/achievements/me`; live check |
| GB-07 | [x] | opt-in topic boards, `PUT /gamify/leaderboards/me`; live check |
| GB-08 | [x] | route-access spec, ownership gates (+35 ai-api gate tests), authorization matrix rows added, api deployed |
| GU-01 | [~] | HUD data (`useGamify`) and stat bar are live; the reward and level-up toast after a quiz submit is not wired into the quiz screens yet |
| GU-02 | [x] | streaks, achievements, leaderboard, profile, settings, support, dashboard; browser matrix at 375, 768, 1280 in light and dark |
| LP-01 | [x] | landing at `/` (Arcjet style), sections without badges or labels (owner request); browser matrix |
| PG-01 | [~] | done: topics (list, detail, search redirect), auth (login, register, verify, forgot, reset), learning (path, sub-topic, lesson, steps, step, chat, quiz), notifications (real API), mastery. Loaded without error at 375 and 1280: profile, skill-tree, sandbox, simulator, wallet, credits, career, marketplace, creators, become-creator, student, teacher. Not restyled inside: those pages keep their own markup |
| PG-02 | [ ] | admin, studio and reviewer pages load but still use the old layouts |
| CL-01 | [~] | AGENTS.md, decisions D-24 to D-26, authorization matrix and tracker RC-19 and RC-20 written; memory updated; final report below |
