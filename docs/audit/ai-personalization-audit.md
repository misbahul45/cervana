# AI Personalization Audit

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-04`
>
> Inventory and assessment of the AI service's learner-model, adaptive policy, and personalization loops. Source: `services/ai-api/` at HEAD `a868095`. Master prompt §11–§19, §44–§49 set the requirements.

## 1. Learner state ingestion (master prompt §13)

The `tutor` agent (`v1/users_steps/generate_user_steps_pipeline.py`) reads:

- `state.topic` (Topic)
- `state.learningStyle` (LearningStyle)
- `state.allLessonSteps` (Lesson steps)
- `state.targetStep` (Step)
- `state.personalityQuizResult` (PersonalityQuizResult with strengths, weaknesses, learningPreferences, motivationFactors, challenges)

It does **not** read:

- `state.learner.mastery` per topic / sub-topic / concept (AI-PERS-04)
- `state.learner.misconceptions` (AI-PERS-05)
- `state.learner.goals`
- `state.learner.confidence`
- `state.learner.evidenceCount`
- `state.learner.recentActivity`
- `state.learner.errorPatterns`
- `state.learner.hintDependency`
- `state.learner.retentionSignals`

The application API has `TopicMasteryRecord` and `MisconceptionPattern` (api-business-flow-traceability.md BF-001) but the AI agent does not consume them.

## 2. Personality extraction (master prompt §17)

`node_personality_material_builder` (lines 141–253) calls `embed_pipeline.llm.invoke` with an LLM prompt to interpret personality scores. The output is a `PersonalityQuizResult` with 5 string lists. The result is stored on `state.personalityQuizResult` and embedded in the path-generation prompt.

**Findings**:
- AI-PERS-01: the LLM interprets personality and the result is treated as authoritative by the path generator. Master prompt §17 says inferred preferences require confidence + evidence count. The service writes the LLM interpretation verbatim. Severity: MEDIUM.
- AI-PERS-02: fallback values (`strengths=["Rasa ingin tahu tinggi"]`) are generic — fine, but they overwrite the model output, not augment it. If the LLM is unavailable the system hard-codes a positive-leaning default that may not match the actual learner. Severity: LOW.
- AI-PERS-03: no validation that the LLM-returned JSON has the right shape; it just `json.loads`. The five fields are extracted with `or [default]` which masks type errors. Severity: LOW.

## 3. Adaptive policy at the AI layer (master prompt §18)

The AI service has **no AdaptivePolicyService**. The path generator (`node_generate` in `generate_user_steps_pipeline.py`) builds a flat ordered list of micro-steps using a generic "Learning Path Master Agent" prompt. There is no:

- difficulty ∈ [0,1] ZPD check
- hint level selection
- scaffolding decision based on misconceptions
- reason codes for why a step was chosen
- policyVersion field
- deterministic decision trace

The application API has the `AdaptivePolicyService` (api-business-flow-traceability.md BF-008, implemented in `services/api/src/v1/personalization/policy/`) but the AI does not call it.

## 4. Personalization loops (master prompt §45–§46)

| Loop | Cadence | Status |
|---|---|---|
| Fast learner adaptation | per interaction | `MISSING` at AI; the application API updates mastery and misconception per LearningEvent |
| Medium-term policy analysis | daily / weekly | `MISSING` (no scheduler in AI; no job runs here) |
| Slow system optimization | weekly / monthly | `MISSING` (no DSPy, no frozen benchmark, no candidate store) |

The three-loop separation in master prompt §65 is not present. The AI is a single-pass LangGraph with no policy.

## 5. Tier coverage (master prompt §46)

| Tier | Status |
|---|---|
| L0 Contextual (current lesson, question, task) | `PARTIAL` (path generator has lessonId and step; quiz pipeline has the user_step) |
| L1 History-aware (recent mistakes, success, hints) | `MISSING` (memory tool exists but not read by the path generator) |
| L2 Skill-aware (mastery, misconceptions, prerequisites) | `MISSING` at AI; `IMPLEMENTED_BUT_NOT_WIRED` at API |
| L3 Preference-aware (style, pacing) | `PARTIAL` (style read from personality quiz; pacing not derived) |
| L4 Longitudinal (retention, recurring errors, long-term goals) | `MISSING` |

The tutor reaches L0 and a partial L3. L1, L2, L4 are missing.

## 6. Tutor behavior table (master prompt §48)

The path generator does not branch on these states:

| State | Expected response | Implemented? |
|---|---|---|
| LOW_MASTERY | explain simply + scaffold | NO (mastery not loaded) |
| HIGH_MASTERY | challenge | NO |
| OPEN_MISCONCEPTION | contrast misconception vs correct concept | NO |
| REPEATED_FAILURE | change representation | NO |
| HIGH_HINT_DEPENDENCY | reduce direct answer exposure | NO |
| RECENT_SUCCESS | increase challenge cautiously | NO |
| FORGOTTEN_CONCEPT | retrieval practice | NO |

The AI generates a path with `order: 1..N` from the LLM and stores it. There is no state machine driving the output.

## 7. Personalization overreach (master prompt §49)

The personality interpretation is always positive-leaning in fallback. The AI never outputs a hardcoded "You always..." sentence (good), but the LLM may produce such language unprompted. There is no output filter. Severity: LOW.

## 8. Memory pipeline (master prompt §44)

See `ai-memory-audit.md`. The AI does not write EpisodicMemory or SemanticLearnerMemory; the memory tool `tool_memory_upsert` is called by `content_pipeline.generate_material` (line 220) with the entire generated text as a single memory. There is no salience filter, no evidence requirement, no confidence, no decay at the AI layer. The application API's `MemoryService` (per `api-business-flow-traceability.md` BF-010) is not invoked from AI.

## 9. Summary scorecard (AI-PERS)

| Area | Status |
|---|---|
| L0 Contextual personalization | `PARTIAL` |
| L1 History-aware | `MISSING` |
| L2 Skill-aware | `MISSING` (at AI) |
| L3 Preference-aware | `PARTIAL` |
| L4 Longitudinal | `MISSING` |
| Adaptive policy | `MISSING` (at AI; present at API) |
| Decision trace (reason codes, policy version) | `MISSING` |
| Difficulty ZPD enforcement | `MISSING` |
| Misconception-driven remediation | `MISSING` |
| Personality validation (evidence, confidence) | `MISSING` |
| Output filter ("never say always") | `MISSING` |
| Three-loop separation | `MISSING` |
| Tutor branching by state | `MISSING` |

## 10. Required next-step

For Phase 3 (Learner Model) and Phase 5 (Adaptive Policy), the AI needs to:

1. Add `state.learner.mastery` and `state.learner.misconceptions` ingestion by calling the application API's personalization endpoints (`/v1/personalization/mastery/me`, `/v1/personalization/misconceptions/active`).
2. Build a typed `AdaptivePolicyClient` in the AI that asks the API for a `next-activity` decision (master prompt §20 contract). The LLM is then called only to realize the chosen strategy, not to choose it.
3. Pass a `reasonCodes` array and `policyVersion` back to the API for every episode, persisted in the DecisionTrace.
4. Add a Pydantic `PersonalityInterpretation` schema with `confidence` and `evidenceCount` fields. Reject interpretations below 0.5 confidence.

These changes are scoped to Phase 3 and Phase 5 per master prompt §109, §111.

## 11. Cross-references

- `ai-foundation-audit.md`
- `ai-domain-audit.md`
- `ai-memory-audit.md`
- `ai-agent-audit.md`
- `ai-evaluation-audit.md`
- `api-business-flow-traceability.md` BF-001, BF-008, BF-010
