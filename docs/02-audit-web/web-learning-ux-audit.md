# Web Learning UX Audit

**Scope:** `apps/web/app/pages/learn/**` + `app/pages/skill-tree/**` + `app/pages/sandbox/**` + `app/pages/simulator/**` + `app/components/skill-tree/**` + `app/components/sandbox/**` + `app/components/learn/**`. Date: 2026-10-05.

## 1. Headline

The master prompt requires the following product surfaces (SC-04 through SC-08):
- SC-04 Learner dashboard with NextActivityCard + MasteryMeter + StreakIndicator.
- SC-05 Skill tree with `LOCKED / AVAILABLE / IN_PROGRESS / MASTERED` states and "Selesaikan [topik] dulu" explanation for locked nodes.
- SC-06 Lesson with `RenderMarkdown`, `Chatbot`, `CitationList`, progress indicator, AI label, citations.
- SC-07 Sandbox scenario list with title, difficulty, prerequisite, estimated effort, learning objective.
- SC-08 Accounting sandbox with `ScenarioEventCard`, `JournalEntryGrid`, `TrialBalanceTable`, `MisconceptionHint`.

## 2. Findings

- `components/skill-tree/` is present (SC-05 surface present).
- `components/sandbox/` is present (SC-08 surface present).
- `components/simulator/` is also present — master prompt §12 expects one `sandbox/` group, not two.
- Mastery visualization uses `MasteryMeter` and `SkillTreeGraph` (per master prompt §54). Files present per directory listing; component-level audit deferred.
- Dashboard surface (`learn/profile/`) is present.
- Sandbox interaction model requires keyboard-reachable controls (master prompt §28). File-level audit deferred.

## 3. Required Follow-Ups (PHASE 2)

1. Consolidate `sandbox/` + `simulator/` into one `sandbox/` namespace.
2. Verify dashboard contains `NextActivityCard` and answers the 5 dashboard questions (where am I / what next / why / how am I progressing).
3. Verify skill tree has 4 states and "Selesaikan [topik] dulu" message for locked nodes.
4. Verify sandbox scenario cards expose prerequisite + estimated effort + learning objective.
5. Verify sandbox workspace is keyboard reachable and gives per-line validation feedback (master prompt §29).