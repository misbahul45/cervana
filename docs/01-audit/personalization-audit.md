# Personalization Audit — Learner State, Mastery, Policy

> **Status**: `stable` · **Owner**: `ml-lead` · **Last reviewed**: `2026-10-09`
>
> Whether the experience changes because of an actual learner state, or only because of a learning-style label.

---

## Scope

Where learner state is stored, derived and consumed; the mastery, misconception and adaptive-policy implementations on both services; and what each of content, difficulty, path, chat, UI, theme and gamification does with that state today. Evidence-class mapping (declared, observed, derived, inferred, preference, system state) follows the target specification.

## Findings

### Evidence classes

| Class | Source in the system | Status | Evidence |
|---|---|---|---|
| Declared | Personality quiz and learning-style profile (`dominantStyle`); strengths, weaknesses, preferences, motivation and challenges from the quiz result feed the learning-path prompt | `PARTIAL` | `services/ai-api/v1/users_steps/generate_user_steps_pipeline.py` (personality material and context nodes); `services/ai-api/v1/learning/content_pipeline.py:313-317` |
| Declared (explicit settings: theme, pace, mode) | none stored per learner | `MISSING` | `LearningPreference` (`services/api/prisma/schema.prisma:1153`) has no reader or writer; no `ExperienceProfile` model exists |
| Observed | `EventLog` rows (`QUIZ_SUBMITTED`), `DailyActivityLog`, `StreakHistory` | `PARTIAL` | `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts:195`; `BehavioralSignals` (`schema.prisma:1164`) unused |
| Derived | `TopicMasteryRecord` (score, confidence, evidence count, attempts), `Misconception` rows, `MasterySnapshot` job | `PARTIAL` | `services/api/src/v1/personalization/mastery/mastery.service.ts:36`; `services/api/src/v1/analytics/snapshots/snapshot.service.ts` |
| Inferred | none (no preference or trait inference with confidence and decay) | `MISSING` | `SemanticLearnerMemory` (`schema.prisma:1200`) unused; Python `PreferenceKey` store unreachable |
| System state | policy version strings (`v1.0.0`, `tutor.v1`, `1.0.0`) | `PARTIAL` | `services/ai-api/v1/learner_model/policy.py:38`; `services/api/src/v1/tutor/tutor.service.ts:260,285-286` |
| `LearnerStateSnapshot` (versioned, typed) | api: none. ai-api: `LearnerState` dataclass exists, built only by self-checks | `UNWIRED` | `services/ai-api/v1/learner_model/state.py`; constructed in production code only inside `golden_scenarios.py` and `mastery.run_golden_vectors` |

### Does learner state change the experience?

| Dimension | Changes with learner state today | Evidence |
|---|---|---|
| Content | Only through the string `dominant_style` in the material prompt and the personality-quiz fields in path generation; learner state, strategy and memory blocks are empty | `content_pipeline.py:313-317,354`; H-004 |
| Difficulty | The api computes a `difficultyTarget`; it is not passed to any generator | `services/api/src/v1/tutor/tutor.service.ts:105,134`; no use in `services/ai-api` |
| Learning path | Deterministic next-topic decision from mastery and active misconceptions, served at `GET /personalization/policy/next` | `services/api/src/v1/personalization/policy/adaptive-policy.service.ts:34-70`; the web references the route once |
| Chat strategy | No: the api strategy never reaches the LLM prompt; chat prompt is a fixed template | `services/ai-api/v1/learning/service.py:325-359` |
| UI, theme, layout | No | [dynamic-ui-audit](./dynamic-ui-audit.md) |
| Gamification | No: streak depends on activity, not on mastery or goal | [gamification-audit](./gamification-audit.md) |

### Mastery, misconception and policy implementations

| Implementation | Location | Model | Used by a production path | Status |
|---|---|---|---|---|
| api `MasteryService.updateFromAttempt` | `services/api/src/v1/personalization/mastery/mastery.service.ts:18-36` | attempt-score update of `TopicMasteryRecord` | quiz submission | `PARTIAL` |
| api `MasteryService` (learner-model) | `services/api/src/v1/learner-model/services/mastery.service.ts:31` | read model for tutor and marketplace | `TutorService`, `MarketplaceDiscoveryController` | `PARTIAL` |
| Python `MasteryService` | `services/ai-api/v1/learner_model/mastery.py:56-` | Elo-style update (`K=24`, learning rate 0.20, decay 0.97, hint damping 0.6) over `LearningEvent`s with per-update deltas and reason codes | none | `UNWIRED` |
| api `MisconceptionService` | `services/api/src/v1/personalization/misconception/misconception.service.ts:31` | record from answer | quiz submission | `PARTIAL` (M-002) |
| api `MisconceptionLifecycleService` | `services/api/src/v1/misconception/misconception-lifecycle.service.ts:32` | rule-based `classify` of count/evidence | `TutorService.recordAttemptOutcome`, which has no caller | `UNWIRED` |
| Python `MisconceptionPipeline` | `services/ai-api/v1/learner_model/misconception.py` | stage machine (candidate → … → resolved) | none | `UNWIRED` |
| api strategy policy | `services/api/src/v1/policy/adaptive-policy.service.ts:75-100` | 12 strategies, difficulty target, hint level, scaffold level, free-text `rationale`, three invariants | `TutorService.respond` | `PARTIAL` |
| api next-topic policy | `services/api/src/v1/personalization/policy/adaptive-policy.service.ts:27-70` | `no_exploration`, `remediation`, … on the golden graph | `GET /personalization/policy/{next,me}` | `PARTIAL` |
| Python `AdaptivePolicyService` | `services/ai-api/v1/learner_model/policy.py:137-` | 13 strategies, `POLICY_VERSION v1.0.0`, typed `reason_codes` | none | `UNWIRED` |

The api policy emits a free-text `rationale`; only the Python policy emits typed reason codes. The two api services named `AdaptivePolicyService` answer different questions (how to teach vs what to learn next).

### H-004

**The live tutor prompt carries no learner state.** `content_pipeline.py:44-58` builds a fresh `TutorRunState` with `user_query="continue material"` and no `learner_state`, no `adaptive_strategy` and no `relevant_memory`, then calls `render_tutor_prompt`. Its renderers return an empty string for each missing block (`services/ai-api/v1/tutor/personalization_prompt.py:36-37,67-68,84-85`). The same prompt still tells the model it is guided by `AdaptivePolicyService` and "memori learner yang relevan" (`:13-14`), lists seven tools it cannot call (`:127-138`), and instructs it to use `adaptive_strategy` and `learner_state` blocks that are absent (`:149-150`). `TutorRuntime` is created at import (`content_pipeline.py:41`); its methods (`attach_learner_state`, `select_strategy`, `recall_memory`) are called only from `v1/tutor/golden_scenarios.py:79-231`. The chat path (`learning/service.py:256-360`) does not use the tutor package at all. Ontology gap: the Python taxonomy has 13 snake_case ids (`contra_account`, `double_entry`, …) and the api golden graph has 65 ids (`l1-t02-debits-credits`, …); the id sets share no element, and no mapping exists, so api mastery cannot key a Python `LearnerState`.

### M-003

**The personal policy is never saved.** `loadOrBuildPolicy` returns `buildEmpty` on both branches (`services/api/src/v1/tutor/tutor.service.ts:229-235`); `persistPolicy` only logs (`:237-241`); `recordAttemptOutcome` (`:154`) has no caller. Every request starts from an empty personal policy, so "preferred strategy" evidence never accumulates. `AdaptivePolicy` rows are written only by the next-topic policy's repository.

### M-004

**Duplicate implementations.** Two `MasteryService`, two `AdaptivePolicyService`, two misconception services in the api, plus Python equivalents of all three. No document or code states which is canonical; their data keys differ (api: topic id, Python: concept id). A single owner per concept is a precondition for the "mastery is reproducible from events" requirement.

## Evidence citations

- `services/ai-api/v1/tutor/{personalization_prompt,context_loaders,golden_scenarios}.py`; `services/ai-api/v1/learning/content_pipeline.py:41,44-58`
- `services/ai-api/v1/learner_model/{state,mastery,policy,misconception,preferences,events}.py`
- `services/api/src/v1/{tutor,policy,personalization,learner-model,misconception}/`
- `services/api/prisma/schema.prisma:1099-1250`
- Ontology comparison: `services/api/prisma/seed-data/golden-accounting-graph.json` (65 ids) vs `services/ai-api/v1/domain/data/default_taxonomy.py` (13 ids), intersection 0
- Tests: `v1/learner_model/__tests__` (38 tests; `run_golden_vectors` in `mastery.py:212` is a self-check), `v1/memory/__tests__` (39); api `tutor`, `policy`, `personalization` specs

## Verdict

Personalization is a label, not a state. The learner model is well specified on the ai-api side and unit-tested, and the api holds real mastery and misconception rows, but nothing joins them: ids differ, no loader exists, and the production prompts do not render the learner blocks. What reaches the LLM is `dominantStyle` and, for path generation, a personality-quiz summary. Preferences, behavior, inferred traits and goals have tables and no code.
