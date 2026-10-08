# Web Gamification Audit

**Scope:** `apps/web/app/components/gamification/**` + `app/components/skill-tree/**` + `app/components/my-learning/**` + relevant pages. Date: 2026-10-05.

## 1. Headline

Master prompt §57–§60 requires:
- Show meaningful learning milestones, XP, achievements, streak, progress.
- Reward is driven by backend `RewardEngine`, not by UI.
- AI never triggers RewardToast just because an API request succeeded.
- Streak represents qualifying learning behavior (never increased by login / heartbeat / chat).
- Leaderboards are opt-in, cohort-scoped, privacy-safe.

## 2. Findings

- `components/gamification/` exists with `StreakIndicator`, `RewardToast`, and likely `Leaderboard*` components.
- The repository's gamification rules (per master prompt §59) reject login/chat farming and require rewards to derive from meaningful learning events. The web layer must NOT compute rewards client-side.
- File-level audit (presence of `RewardToast` consumers, leaderboard opt-in toggle) is deferred.

## 3. Required Follow-Ups (PHASE 7)

1. Verify `RewardToast` consumers are wired only to backend-confirmed reward events.
2. Verify leaderboard pages have an opt-in toggle and a cohort/topic filter.
3. Verify `StreakIndicator` shows a qualifying event label (not just "Streak +1").