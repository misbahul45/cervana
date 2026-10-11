# ADR-018: Play skin as the default theme, theme icons for gamification, and gamify rules as database rows

- Status: accepted for implementation on 2026-10-10 (the owner asked to restyle the whole UI after Duolingo, restyle the landing page after Arcjet, follow the database rules of dynamic gamification based on theme icons, seed one default theme first and let users create dynamic themes later); the rule values and the palette are proposals (decisions D-24 and D-25)
- Date: 2026-10-10

## Context

`docs/strategy/08-gamification-and-theme.md` defines the target: rewards paid only for verified learning from versioned `RewardRule` rows, a streak that logins and chat never credit, freezes that are earned, opt-in boards ranked by concepts mastered, and a theme resolved from a user theme, the content chain, a level variant and a default. `docs/01-audit/dynamic-theme-audit.md` (H-009) found the theme stack unconnected: the default theme is never fetched, the resolver has no caller and the shell receives no props. `docs/01-audit/gamification-audit.md` found the achievement catalog empty and the badge evaluator unwired, the level computed from active days, and rule values written as constants. Since then the reward ledger and the learning events exist (ADR-014, ADR-015).

## Decision

1. **Default theme.** A new theme `reducera-play` (title "Play") is seeded as the default, light first, with a dark scheme. `reducera-ocean` stays as a published, non-default theme that content can reference. Both JSON copies (api seed data and web bundle) stay byte-identical and `check-theme-sync.sh` covers both files.
2. **Contract v2, additive.** The 14 required tokens do not change and keep their contrast rules. Optional tokens are added per scheme: `success`, `danger`, `warning`, `info`, `gold`, `flame` and the depth colors `primaryDepth`, `secondaryDepth`, `dangerDepth`, `goldDepth`. An optional `shape` block (`radius`, `depth`) says how chunky the components are. Optional keys are validated as hex when present and merged with defaults when absent, so older themes keep working.
3. **Theme icons carry the gamification.** Icon names come from a closed vocabulary (`streak`, `xp`, `star`, `level`, `badge`, `league`, `freeze`, `node`, `lock`, `trophy`). An icon is resolved by name through the theme chain, then the default theme, then a bundled fallback shipped with the web, so a page renders with the API down. `GET /themes/default` is public and returns the icons; a name is unique per theme. The default theme's icons are original artwork shipped in `apps/web/public/themes/reducera-play/icons` and seeded as `ThemeIcon` rows.
4. **Two surfaces, one token set.** The application uses the Play skin through `--rc-*` variables and the shape block. The landing page is a separate marketing surface in a fixed dark skin after Arcjet; it is not learner themed, but it reads the default theme's gamification icons so what it sells is what the app shows.
5. **Gamify rules are rows.** `RewardRule(code, version, eventType, rewardKind, amount, dailyCap, params, active)` is read by the engine; the current catalog (`MASTERY_PROGRESS`, `CONCEPT_PASSED`, `STREAK_BONUS_7`) moves from constants to rows and new rules are added by rows (`PATH_NODE_MASTERED` pays one star, `STREAK_FREEZE_EARNED`). Level thresholds are rows (`LevelThreshold`) and the level is computed from ledger XP, not from active days. Achievements are rows with a typed rule and an icon name; an evaluator runs inside the grading transaction after the reward engine. Changing a number is a new rule version, never an edit.
6. **Currencies.** `GamificationLedger` gains `kind` (`XP`, `STAR`); stars are a projection of `STAR` rows, written in the same transaction. Spending stars is not built.
7. **Streak.** A streak day is a local day with at least one qualifying learning event (a graded assessment with evidence). Chat messages, step creation and logins never qualify. `User.timezone` defines the day. One freeze is earned per seven consecutive days, at most two are held, a missed day consumes one.
8. **Boards.** A learner joins a board explicitly; boards are scoped to a topic, ranked by concepts passed in the current week, and show a handle, not a name. There is no global board in the UI.
9. **Not built, on purpose** (strategy 08): quests and missions, a lives mechanic (`souls` stays hidden until a rule exists), sold streak freezes, a global board, rewards for activity. "Selling gamification" means the landing page presents the mechanisms that exist.
10. **Dynamic user themes later.** The resolver accepts a user theme as the first entry of its chain and the validator and lifecycle already exist; the user preference field and the endpoint are the next stage and are not built here.

## Consequences

- One look across the application and a data driven way to change it; the owner can add a theme by data.
- Light mode uses a darker green than the brand bright green because the validator requires AA contrast for text; bright greens are decoration only. Dark mode uses the bright green.
- Level and streak change meaning (learning, not activity); existing counters on `User` become projections.
- A chat message no longer extends a streak (a behavior change that closes H-008 vectors 2 and 3, to be confirmed by the owner with D-25).
- The global leaderboard rows written by the ledger projection stay in the table; the UI stops showing a global board.
- Design: `docs/architecture/play-ui-and-themed-gamify.md`; tasks: `docs/plans/play-ui-plan.md`.
