# AI Gamification Audit — services/ai-api

**Scope:** Phase 0 master-prompt §50, §51, §52, §53, §54, §55, §56, §101, §113, §121. Map-and-list depth.
**Audit date:** 2026-10-05.
**Service container:** `reducera_ai_api` :3003. **Source of truth:** `services/api` :3002 (NestJS).
**Evidence rule:** every claim cites a file and line range, or `MISSING` is stated.

---

## 1. Headline Verdict

`services/ai-api` contains **zero** gamification code: no `RewardEngine`, no `GamificationLedger`, no `LearningEvent` / `MasteryChange` / `ScenarioOutcome` / `LearningMilestone` / `CreatorOutcome` types, no XP-minting, no streak mutation, no leaderboard write, no celebration/narration function, no farming-prevention test. This is the **architecturally correct** placement: per `AGENTS.md:145`, the append-only `GamificationLedger` table sits behind `forbid_row_mutation` triggers in `services/api`, and ai-api has no business minting value. The boundary is enforced by absence. The drawback is that the AI also has **no narration hook** to celebrate a milestone once the api-side `RewardEngine` has granted it; the foundation audit (`ai-foundation-audit.md` §10) already flags the missing decision-trace + episode write, and that gap extends to gamification narration as well.

## 2. Entry Surface (`main.py`, `v1/router.py`)

| Item | Status | Evidence |
|---|---|---|
| FastAPI app with title/version/root | PRESENT | `main.py:9-34` |
| v1 prefix bound to `APP_VERSION` env | PRESENT | `v1/router.py:6-12` |
| Three sub-routers mounted: resources, users-steps, learning | PRESENT | `v1/router.py:10-12` |
| Agents router mounted separately at `/ai/v1/agents` | PRESENT | `main.py:37` |
| Gamification route mounted under `/ai/v1/gamify` or `/ai/v1/rewards` | **MISSING** | not present in `v1/router.py:10-12`; `codebase-memory-mcp` routes list shows 7 routes total, none gamification-related |
| `RewardEngine` Python module | **MISSING** | no `reward_engine.py`, `rewardEngine.py`, or `gamification.py` in `services/ai-api/` (`file_tree` aspect returns 35 paths, none gamification) |
| `GamificationLedger` Python module | **MISSING** | not in `services/ai-api/`; exists as Prisma table in `services/api/src/v1/gamify/` (out of scope) |

## 3. RewardEngine (master prompt §51)

| Item | Status | Evidence |
|---|---|---|
| `RewardEngine` consumer of `LearningEvent` | **MISSING** | no symbol `RewardEngine` in any ai-api file (graph search `rewardEngine` returns 0 results scoped to `services/ai-api/`) |
| `RewardEngine` consumer of `MasteryChange` | **MISSING** | no `MasteryChange` type defined or imported; only `mastery_score` floats appear in `career_agent.py:25` as a local variable over API response |
| `RewardEngine` consumer of `ScenarioOutcome` | **MISSING** | no `ScenarioOutcome` type; closest existing type is `QuizItem.type: Literal[..."scenario"]` at `v1/users_steps/dto.py:129` — describes a *quiz format*, not a scenario-outcome event |
| `RewardEngine` consumer of `LearningMilestone` | **MISSING** | no `LearningMilestone` type; no reference to the word `milestone` in any ai-api `.py` (grep `milestone` returns 0) |
| `RewardEngine` consumer of `CreatorOutcome` | **MISSING** | `creator_assistant_agent.py:7-41` only reads `/v1/articles/mine`, `/v1/classes/mine`, `/v1/studio/earnings/me`; it does not consume or emit any `CreatorOutcome` event |
| Emits `RewardDecision` with `{eligible, rewardType, amount, ruleId, ruleVersion, reason}` | **MISSING** | no `RewardDecision` type, no `rewardType` enum, no `ruleId` / `ruleVersion` fields anywhere in ai-api |
| `rewardType` enum (XP, star, streak, badge, coin, level-up, leaderboard promotion) | **MISSING** | no enum or union of reward types |
| `ruleVersion` per reward rule | **MISSING** | no rule registry, no versioned-rule concept |
| Tests asserting no reward emitted when eligibility is false | **MISSING** | no test file under `__tests__` or `v1/*/__tests__` contains `reward`, `xp`, or `eligible` (test files present: `test_main_no_subprocess_spawn.py`, `test_main.py`, `test_web_search.py`, `test_curriculum_agent.py`, `test_router_dispatch.py`, `test_router_endpoint.py`, `test_rag_recall.py`, `test_service_prompt_fence.py`, `test_tutor_citation.py`) |

## 4. GamificationLedger (master prompt §52)

| Item | Status | Evidence |
|---|---|---|
| `GamificationLedger` DTO with `{userId, kind, delta, ruleId, ruleVersion, eventId, idempotencyKey, createdAt}` | **MISSING** | not in `v1/learning/dto.py` or `v1/users_steps/dto.py` (full file scan of both DTOs, lines 1-210) |
| `kind` enum (XP_GRANT, XP_REVERSAL, STREAK_INCREMENT, BADGE_AWARD, LEVEL_UP, LEADERBOARD_PROMOTION) | **MISSING** | no enum present |
| `idempotencyKey` field on every ledger write | **MISSING** | ai-api issues no ledger writes; the api-side `idempotencyKey` is per the `Idempotency-Key` header (foundation audit §8), not per gamification event |
| Append-only invariant enforced in ai-api | N/A | ai-api has no ledger; the `forbid_row_mutation` trigger is on the api-side table per `AGENTS.md:145` |
| Reversal via compensating entry | **MISSING in ai-api** | correct placement: reversal is a `XP_REVERSAL` row in the api-side `GamificationLedger` (out of scope here) |
| Idempotency key for `(userId, ruleId, eventId)` dedup | **MISSING in ai-api** | correct: dedup lives in the api-side `IdempotencyService` (foundation audit §8) |

## 5. Learning-Event-Driven Reward (master prompt §50, §56)

| Item | Status | Evidence |
|---|---|---|
| AI can explain reward (post-decision) | **MISSING** | no function in any agent/pipeline that takes a `RewardDecision` and renders text |
| AI can celebrate progress | **MISSING** | no `celebrate`, `congratulat`, or `congrats` token anywhere in `services/ai-api/**/*.py` (grep returns 0) |
| AI can suggest next challenge | PARTIAL | `v1/users_steps/generate_user_steps_pipeline.py:288-299` contains prompt text "Motivational, practical, short" and "Cognitive load LOW, motivation HIGH" — but this is part of the *learning-path generation* prompt, not a post-reward celebration. The path planner proposes *steps*, not *challenges* in the gamification sense |
| AI can narrate milestones | **MISSING** | no milestone-consumer function, no `LearningMilestone` event subscriber, no narration function |
| AI CANNOT mint XP | PRESENT (enforced by absence) | no code path in ai-api writes to any XP table; Prisma client is not even imported in ai-api (Python only; `services/ai-api/pyproject.toml` declares no SQLAlchemy/Prisma) |
| AI CANNOT grant stars | PRESENT (enforced by absence) | no `grant_star`, `award_badge`, `coin_add` symbol anywhere |
| AI CANNOT change streak | PRESENT (enforced by absence) | no streak mutation; `services/api/dist/v1/gamify/streaks/streaks.service.js` exists (build artifact), source is `services/api/src/v1/gamify/streaks/` (out of scope) |
| AI CANNOT modify leaderboard | PRESENT (enforced by absence) | no leaderboard write; ai-api only carries `leaderboardScores: Optional[List[Any]] = None` as a passive projection on `TopicBase` at `v1/users_steps/dto.py:29` (declared, never read or written by any agent/pipeline) |
| AI CANNOT fabricate achievement | PRESENT (enforced by absence) | no achievement creation code |

## 6. No-Farming Guarantees (master prompt §53)

| Item | Status | Evidence |
|---|---|---|
| Test: same event twice → one reward | **MISSING in ai-api** | correct placement: dedup is the api-side `IdempotencyService` (`AGENTS.md:139-140`) |
| Test: replay passed scenario → 0 reward | **MISSING in ai-api** | correct: replay-detection is api-side |
| Test: too-fast completion → 0 reward | **MISSING in ai-api** | correct: timing check is api-side |
| Test: login → no streak | **MISSING in ai-api** | correct: streak update is api-side |
| Test: chat message → no streak | **MISSING in ai-api** | correct: streak update is api-side |
| Boundary test in ai-api asserting "AI does not write to gamification tables" | **MISSING** | no import of `GamificationLedger` model, no HTTP call to `/v1/gamify/*` from ai-api (only GETs to `/v1/personalization/*`, `/v1/marketplace/classes`, `/v1/articles/mine`, `/v1/classes/mine`, `/v1/studio/earnings/me`, `/v1/personalization/memory` — see `v1/agents/curriculum_agent.py:27-46`, `v1/agents/career_agent.py:18-19`, `v1/agents/creator_assistant_agent.py:18-20`) |
| End-to-end test that the api-side idempotency key dedups a duplicate ai-issued event | **MISSING in ai-api** | no such test |

## 7. XP Represents Value (master prompt §54)

| Item | Status | Evidence |
|---|---|---|
| XP must be tied to mastery progress / validated practice / meaningful completion / scenario success / knowledge contribution / learning milestones | N/A — no XP grant exists in ai-api | the policy is enforced by the absence of any code path that mints XP from non-value events |
| XP NOT granted for: requests, time online, chat messages, page views | PRESENT (enforced by absence) | ai-api code that *produces* a side effect on a user (`v1/learning/workers.py`, `v1/users_steps/workers.py`) only POSTs to `/v1/personalization/memory` (short-term memory) and to content/question-result endpoints on the api (`v1/learning/service.py:18,27,46,59,67,83` — all POSTs to api's `create_content_material` and similar). No POST targets a gamification endpoint. Confirmed by grep for `POST|post` in `v1/learning/workers.py` and `v1/users_steps/workers.py`: no gamification-related matches |
| Test: chat message → no XP | **MISSING in ai-api** | correct: enforcement is api-side |
| Test: page view → no XP | **MISSING in ai-api** | correct: enforcement is api-side |

## 8. Leaderboard Principle (master prompt §55)

| Item | Status | Evidence |
|---|---|---|
| `leaderboardScores` projection declared on `TopicBase` | PRESENT but INERT | `v1/users_steps/dto.py:29` — `leaderboardScores: Optional[List[Any]] = None`. Never read, never assigned. Confirmed by `grep -rn "leaderboardScores" services/ai-api --include="*.py"` returning exactly 1 hit (the declaration) |
| Ranking by learning outcome (not activity spam) | N/A — ai-api does not rank | no ranking function in ai-api; the api-side `leaderboards.service.ts` owns ranking (`services/api/src/v1/gamify/leaderboards/`) |
| Opt-in enforcement | N/A — ai-api does not enroll users | api-side concern |
| Cohort / topic scope | N/A — ai-api does not scope | api-side concern |
| Handle-based, privacy-safe display | N/A — ai-api does not display | api-side concern |
| AI does not push users into leaderboards | PRESENT (enforced by absence) | no leaderboard-write endpoint call |

## 9. AI + Gamification Boundary (master prompt §56)

| Item | Status | Evidence |
|---|---|---|
| AI narrates; `RewardEngine` decides | PARTIAL — narrate side MISSING | `RewardEngine` lives on the api-side (correct); AI narration hook MISSING (no `LearningEvent` subscriber, no `render_reward_narration(state, decision)` function) |
| Decision trace records both sides | PARTIAL | foundation audit §10 already flags decision-trace missing for learning + users-steps paths; same gap covers gamification narration |
| `services/api` does not delegate reward decisions to `ai-api` | PRESENT (correct) | `services/api/src/v1/gamify/` modules are self-contained; no outbound call to ai-api from reward paths (build artifacts under `dist/v1/gamify/` do not import any ai-api path) |
| `ai-api` does not decide eligibility | PRESENT (correct) | no eligibility-check function, no `RuleVersion` registry, no `decision_eligible()` call |
| `ai-api` does not compute `rewardType` or `amount` | PRESENT (correct) | no reward-computation code |
| `ai-api` only reads gamification state for context | PARTIAL | `leaderboardScores` field on `TopicBase` (`v1/users_steps/dto.py:29`) suggests intent to *consume* leaderboard context, but the field is never assigned or read; the actual read paths in `career_agent.py:18` read `/v1/personalization/mastery/me`, not leaderboard data |

## 10. Cybersecurity Boundary (AGENTS.md §2)

| Item | Status | Evidence |
|---|---|---|
| Gamification tables owned by `services/api` (not ai-api) | PRESENT | `services/api/src/v1/gamify/{badges,daily-logs,leaderboards,level,streaks,themes}/` are the only gamification source paths; no `gamify/` directory in `services/ai-api/` (file_tree aspect lists 35 paths under `services/ai-api`, none gamification) |
| `GamificationLedger` is append-only with `forbid_row_mutation` triggers | PRESENT (api-side) | `AGENTS.md:145` declares the invariant; ai-api has no Prisma/SQLAlchemy client (`pyproject.toml:7-30`) so it physically cannot write to the table |
| ai-api cannot import the Prisma client | PRESENT (correct) | no `prisma`, `@prisma/client`, `sqlalchemy`, or `psycopg2` dependency in `services/ai-api/pyproject.toml`; no `prisma` import in any ai-api `.py` |
| ai-api cannot bypass via raw SQL | PRESENT (correct) | no `psycopg2`, `asyncpg`, or raw-SQL token in ai-api |
| ai-api has no DATABASE_URL env var | PRESENT (correct) | `config/envs.py:7-32` (referenced by foundation audit) declares no `DATABASE_URL` field; `INTERNAL_AI_API_SECRET` is the only DB-adjacent secret, used to sign cross-service calls |
| ai-api does not push to leaderboard via direct DB call | PRESENT (correct) | no DB driver in the dependency graph; ai-api can only mutate state through signed HTTP to the api |
| ai-api can be called by api-side gamification code as a narrator only via signed internal contract | PARTIAL | ai-api has `config/service_auth.py` (signing outbound), but the inbound side has no `InternalServiceGuard` (foundation audit §4 flags this). A future api-side reward path that wants the AI to *narrate* a `RewardDecision` would have to add such a guard |

## 11. Tests for Gamification (master prompt §101)

| Item | Status | Evidence |
|---|---|---|
| Duplicate event → one reward | **MISSING in ai-api** | correct: enforcement is api-side `IdempotencyService` |
| Scenario replay → no reward | **MISSING in ai-api** | correct: api-side |
| Too-fast completion → no reward | **MISSING in ai-api** | correct: api-side |
| Login → no streak | **MISSING in ai-api** | correct: api-side |
| Chat → no streak | **MISSING in ai-api** | correct: api-side |
| Milestone → reward | **MISSING in ai-api** | ai-api has no milestone-consumer code; the celebration hook is also missing, so even a successful api-side `RewardDecision` would not surface in any AI response today |
| Reward reversal → compensating ledger entry | **MISSING in ai-api** | correct: api-side |
| Leaderboard opt-in | **MISSING in ai-api** | correct: api-side `leaderboards.service.ts` |
| Ranking based on learning outcome | **MISSING in ai-api** | correct: api-side `leaderboards.repo.ts` |
| Boundary test: ai-api never writes to gamification tables | **MISSING** | a regression test asserting "no `prisma.leaderboardScore.create/update`, no `gamifyLedger` write, no `streakService.update`" call exists in the source code of ai-api is **not present**. The test would be cheap (parse the AST or grep) and would catch a future contributor who, e.g., adds `httpx.post(f"{api_base}/v1/gamify/streaks/...", ...)` |
| Test that AI narration function returns the *given* `RewardDecision` text without modifying it | **MISSING** | no such contract exists |
| Test that agents do not POST to any `/v1/gamify/*` endpoint | **MISSING** | `v1/agents/__tests__/test_router_dispatch.py` and `test_curriculum_agent.py` exist but assert no outbound gamification POSTs |

## 12. Critical Defects (gamification boundary)

| Severity | Defect | Location |
|---|---|---|
| HIGH | No AI-side narration hook to celebrate a `RewardDecision` once the api-side `RewardEngine` grants it | `v1/agents/{curriculum_agent,career_agent,creator_assistant_agent}.py:7-50` — no `render_reward_narration` function; `v1/learning/content_pipeline.py:254-271` does not accept a `RewardDecision` input |
| HIGH | No boundary test asserting ai-api never POSTs to any `/v1/gamify/*` endpoint | `services/ai-api/v1/agents/__tests__/` — no such test |
| MEDIUM | Passive `leaderboardScores` projection on `TopicBase` is declared but never consumed or assigned, inviting a future contributor to wire AI writes through it | `v1/users_steps/dto.py:29` |
| MEDIUM | Personality-driven "motivation" prompts do not reference the user's actual reward state, so the AI can suggest a "next challenge" disconnected from the api's `RewardDecision` | `v1/users_steps/generate_user_steps_pipeline.py:79, 265, 277, 288-299` — "Motivation Factors", "Motivational, practical, short" prompts without reward-state input |
| MEDIUM | No `InternalServiceGuard` on ai-api inbound calls; a future api-side reward narration endpoint would land in ai-api without a signed-handshake boundary | `main.py:1-42` — no verification middleware; foundation audit §4 already flags this |

## 13. Evidence Trail Summary

| Source | What it confirms |
|---|---|
| `codebase-memory-mcp search_code regex xp\|reward\|streak\|leaderboard\|...` over `services/ai-api/**/*.py` | 30 grep matches, 18 deduplicated functions — all confirmed false positives (prompt text "expert AI Learning Assistant", embedding math `expected_rows`, benchmark test data with accounting "ledger" word, JSON "expert personality engine", rate-limit `pytest.fail`). Zero gamification symbols. |
| `codebase-memory-mcp search_graph query "reward engine gamification leaderboard xp streak"` with `qn_pattern=*ai-api*` | 0 results — no symbol by any gamification name exists in the ai-api graph |
| `codebase-memory-mcp get_architecture path=services/ai-api` | 7 routes total (`POST /generate-material`, `POST /chat`, `GET /generate-question`, `POST /generate`, `POST /run`, `POST /extract`, `POST /embedding/{resource_id}`); 12 clusters (signed_headers, agent dispatch, embedding, prompt segmentation, rate limiting, etc.); 0 gamification clusters |
| `codebase-memory-mcp get_architecture file_tree` | 35 paths under `services/ai-api`; no `gamify/`, `reward/`, `streak/`, `leaderboard/`, `xp/`, `badge/`, or `achievement/` directory |
| `services/ai-api/v1/agents/curriculum_agent.py:1-50` | Calls only `/v1/personalization/policy/next`, `/v1/personalization/memory` (GET+POST). No gamification endpoints. |
| `services/ai-api/v1/agents/career_agent.py:1-38` | Calls only `/v1/personalization/mastery/me`, `/v1/marketplace/classes`. No gamification endpoints. |
| `services/ai-api/v1/agents/creator_assistant_agent.py:1-41` | Calls only `/v1/articles/mine`, `/v1/classes/mine`, `/v1/studio/earnings/me` (read-only earnings). No gamification endpoints. |
| `services/ai-api/v1/users_steps/dto.py:1-210` | Two false-positive fields: `leaderboardScores: Optional[List[Any]] = None` (line 29, passive projection, never assigned/read) and `PersonalityQuizValue.level` (line 167, personality domain, not gamification) |
| `services/ai-api/v1/learning/workers.py`, `v1/users_steps/workers.py` | No `POST|post|gamify|reward|leaderboard` references; workers only post content material + question results back to the api |
| `services/api/src/v1/gamify/` | 6 subdomains: `badges/`, `daily-logs/`, `leaderboards/`, `level/`, `streaks/`, `themes/` — the canonical home of gamification, with `gamify.module.ts` mounting them. ai-api has no equivalent |
| `AGENTS.md:93, 138, 145` | `services/api` owns `gamification ledger`; `forbid_row_mutation` triggers on `LedgerTransaction`, `AICreditLedgerEntry`, `GamificationLedger`, `DomainEvent` |
| `services/ai-api/pyproject.toml:7-30` | No Prisma, no SQLAlchemy, no DB driver — ai-api physically cannot write to any DB table |

## 14. What Phase 7 / 11 Must Build (gamification boundary in ai-api)

```text
1.  Add services/ai-api/v1/gamification/__init__.py + router.py (read-only) under /ai/v1/gamification
    - GET /ai/v1/gamification/reward-preview?eventId=...   (returns api-computed RewardDecision text without granting)
    - GET /ai/v1/gamification/leaderboard-context?topicId=...  (read-only projection; do NOT mutate)
    Mount in services/ai-api/v1/router.py:13 (one new include_router line)

2.  Add services/ai-api/v1/agents/reward_narrator.py
    - async def render_reward_narration(reward_decision: RewardDecisionDto, personality: PersonalityQuizResult) -> str
    - Prompt must accept ruleId, ruleVersion, rewardType, amount as typed inputs (not re-decide)
    - Must NOT call any /v1/gamify/* write endpoint; must NOT re-compute eligibility

3.  Add services/ai-api/v1/gamification/dto.py
    - RewardDecisionDto (eligible, rewardType, amount, ruleId, ruleVersion, reason)
    - RewardTypeEnum (XP, STAR, STREAK, BADGE, COIN, LEVEL_UP, LEADERBOARD_PROMOTION)
    - LeaderboardContextDto (cohortId, topicId, handle, score, rank, optIn)

4.  Add services/ai-api/v1/agents/__tests__/test_reward_narrator.py
    - assert narration function returns text faithful to the given RewardDecision (no XP inflation, no fabricated reason)
    - assert no httpx.post call to /v1/gamify/* paths

5.  Add services/ai-api/v1/agents/__tests__/test_no_gamify_writes.py (boundary regression)
    - Static scan: assert no source file under services/ai-api/ contains a POST to any /v1/gamify/* or /v1/streaks/* or /v1/leaderboards/* or /v1/badges/* or /v1/level/* endpoint
    - Assert services/ai-api/pyproject.toml has no DB driver (prisma, sqlalchemy, asyncpg, psycopg2)
    - Assert no "RuleVersion" or "eligible" computation in any ai-api source

6.  Wire services/ai-api/v1/learning/content_pipeline.py:264-271
    - Accept optional reward_decision: RewardDecisionDto in state
    - In the final synthesis node, call render_reward_narration if reward_decision is present
    - Never block content generation on reward_decision absence

7.  Wire services/ai-api/v1/agents/curriculum_agent.py:7-50
    - On policy decision, optionally fetch /v1/gamification/reward-preview?lessonId=...
    - Pass reward_decision into the LLM prompt only as typed context, not as instructions

8.  Replace v1/users_steps/dto.py:29 (leaderboardScores) with leaderboardContext: Optional[LeaderboardContextDto]
    - Typed projection; consumed by reading api-side /v1/gamification/leaderboard-context?topicId=...
    - Document in field comment that the AI never writes leaderboard state

9.  Add config/internal_inbound_guard.py
    - HMAC verification of x-service-id, x-service-timestamp, x-service-signature on inbound requests
    - Mounted as middleware in services/ai-api/main.py:25
    - Reject if any /v1/gamification/* write endpoint is ever added without a signed contract

10. Update services/ai-api/v1/agents/__init__.py
    - Export render_reward_narration alongside run_curriculum
    - The narrator is the only AI-side function allowed to *read* gamification state; it never writes

11. Add integration test in services/ai-api/v1/agents/__tests__/test_curriculum_agent.py
    - Given a duplicate /v1/gamification/reward-preview call with the same eventId, the agent issues exactly one narration (idempotent on the AI side; the api-side IdempotencyService handles the upstream dedup)
    - Given a /v1/gamification/streaks POST attempt in any agent, the test fails the build (regression guard)

12. Add services/ai-api/docs/gamification-boundary.md
    - Document the rule "AI narrates, RewardEngine decides"
    - Reference services/api/src/v1/gamify/* as the canonical owner
    - List every reward endpoint the AI is allowed to READ and confirm none are allowed to WRITE
```

(End of file - total 209 lines)
