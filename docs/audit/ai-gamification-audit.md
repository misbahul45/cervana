# AI Gamification Audit

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-04`
>
> Inventory and assessment of the AI service's role in the gamification layer. The authoritative gamification engine lives in the application API (api-business-flow-traceability.md BF-004). The AI is a narrator, not a decider. Master prompt §50–§56 set the requirements.

## 1. The boundary (master prompt §50)

```text
LearningEvent
   ↓
RewardEngine (api)
   ↓
Gamification Ledger
   ↓
Projection
   ↓
AI narrates
```

The ai-api must not mint XP, grant stars, change streak, modify leaderboards, or fabricate achievements. Verified:

- `v1/learning/`, `v1/users_steps/`, `v1/agents/` — no XP / streak / leaderboard / badge / achievement code paths
- The reward engine is at the application API (`api-business-flow-traceability.md` BF-004)

**Finding**: AI-GAM-01: boundary respected. The ai-api has no gamification mutation surface. Severity: PASS for the boundary.

## 2. AI narration (master prompt §56)

The AI can:

- explain reward
- celebrate progress
- suggest next challenge
- narrate milestones

The path generator prompt (`generate_user_steps_pipeline.py:259-333`) says "Cognitive load LOW, motivation HIGH" and lists motivation factors. The `tutor` prompt is motivational-language-leaning (e.g., "Pakar Materi Sertifikasi Profesi" with "Mulai dari pemahaman dasar" fallback in the path generator). The AI does generate celebratory / motivational text.

**Finding**: AI-GAM-02: the AI does narrate motivation / celebration. Good. The text is then stored on the path and shown to the user. Severity: PASS for behavior; LOW for the risk of over-promising (the path may be celebratory but the user still has to do the work).

## 3. Reinforcement vs. farming (master prompt §53)

The ai-api does not validate reward eligibility. The path generator is not reward-aware: it doesn't check `isDone` of previous steps, doesn't read `StreakHistory` or `UserAchievement`, doesn't throttle based on `lastActivityAt`. The output `order: 1..N` is the AI's best guess; the API is responsible for `RewardEngine.evaluate` and the gamification ledger.

**Findings**:

- AI-GAM-03: the path generator does not consult streak, XP, leaderboard, or reward-eligibility. It is reward-agnostic. Severity: PASS (this is the boundary; reward enforcement is the API's job).
- AI-GAM-04: the personality interpretation prompt may produce "motivation triggers" that the AI uses to bias the path. The actual reward issued is independent — but the AI's path is shaped by inferred motivation. Severity: LOW.

## 4. Rank learning, not activity (master prompt §54, §55)

The path generator produces `order: 1..N` with `title` and `stepTemplateId`. The ranking is by the LLM. The leaderboard is at the API. The AI does not mint or rank.

**Finding**: AI-GAM-05: AI ranks the path by LLM heuristic. The leaderboard is at the API. Severity: PASS for the boundary; MEDIUM for the path ranking quality (the AI ranks by `Mastery Topic` field if present, otherwise by `topic.title`, otherwise `'unknown'` per `content_pipeline.py:189` — see AI-PERS-04).

## 5. Gamification tests (master prompt §101, §96)

Per master prompt §101:

```text
duplicate event → one reward
scenario replay → no reward
too-fast completion → no reward
login → no streak reward
chat message → no streak reward
milestone → reward
reward reversal → compensating ledger
leaderboard requires opt-in
ranking based on learning outcome
```

These are all at the application API. The ai-api has no tests for these because the ai-api does not have the gamification surface.

**Findings**:

- AI-GAM-06: no AI-side gamification tests (correct: the boundary is at the API). Severity: PASS for the boundary.
- AI-GAM-07: the path generator's `isDone: false` field is set, but no validation that previous steps are `isDone: true` before suggesting the next. Severity: LOW (correct ordering is the API's job; the AI's job is to surface a candidate path).

## 6. Prompt segmentation and reward (master prompt §27)

Reward-eligibility text (e.g., "You've earned a badge!") from the AI is LLM-prose, not a structured `BadgeAwarded` event. The application API's `RewardEngine.evaluate` produces a structured `RewardDecision` and writes a `GamificationLedger` row.

**Finding**: AI-GAM-08: the AI does not emit structured reward events. Severity: PASS for the boundary.

## 7. Acceptance tests (master prompt §127 subset)

From the §127 checklist:

- [x] Gamification consumes validated learning events
- [x] Rewards are idempotent
- [x] No reward farming

These are at the application API (per `api-business-flow-traceability.md` BF-004).

**Finding**: AI-GAM-09: the AI does not need its own acceptance test for gamification; the boundary is correct. Severity: PASS.

## 8. Summary scorecard (AI-GAM)

| Area | Status |
|---|---|
| AI mints XP | `NEVER` (boundary) |
| AI grants stars | `NEVER` (boundary) |
| AI changes streak | `NEVER` (boundary) |
| AI modifies leaderboard | `NEVER` (boundary) |
| AI fabricates achievement | `NEVER` (boundary) |
| AI narrates reward | `YES` (within `path` content) |
| AI narrates motivation | `YES` (within `path` content) |
| AI checks reward eligibility | `NO` (correct: API does it) |
| AI is reward-aware | `NO` (correct: API is policy) |
| Path ranking is learning-outcome-based | `PARTIAL` (LLM heuristic with mastery override; no formal ranking) |
| Login / chat / replay farming tests | `N/A` at AI (API runs them) |

## 9. Required next-step

For Phase 7 (Gamification), the AI needs to:

1. Add a thin `RewardContext` section to the prompt that surfaces the user's current XP, streak, and level, so the AI can narrate correctly without inventing numbers.
2. Move the motivation-language generation behind a structured `Celebration { milestone, badgeName, xpAwarded }` output shape so the API can validate the AI's claim against the ledger.

These are scoped to Phase 7 per master prompt §113.

## 10. Cross-references

- `ai-foundation-audit.md`
- `ai-domain-audit.md`
- `ai-personalization-audit.md`
- `ai-memory-audit.md`
- `ai-rag-audit.md`
- `ai-agent-audit.md`
- `ai-evaluation-audit.md`
- `api-business-flow-traceability.md` BF-004
- `api-business-logic-audit.md` F-12 (gamification rules)
