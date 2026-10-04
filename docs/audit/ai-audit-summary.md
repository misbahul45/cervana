# AI Audit Summary — Answers to the 18 Audit Questions

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-04`
>
> Consolidated answers to master prompt §106's 18 audit questions. Every answer is evidence-cited with file:line references. Detailed findings are in the 8 per-layer audit documents.

The 18 questions and the current answer for each:

| # | Question | Answer | Where the answer lives |
|---|---|---|---|
| 1 | Is the tutor actually adaptive? | `NO` — the tutor (`run_curriculum`) reads topic + step + LLM-step, no mastery or misconception state. The path generator uses LLM heuristic. Adaptive policy is at the application API, not consumed by the AI. | `ai-agent-audit.md` §13, `ai-personalization-audit.md` §3 |
| 2 | Is learner state persistent? | `PARTIAL` — the application API persists mastery and misconceptions in `TopicMasteryRecord` and `MisconceptionPattern`. The AI does not write to either. The AI's only persistence is `EpisodicMemory` (Qdrant) via `tool_memory_upsert` with no policy. | `ai-memory-audit.md` §1 |
| 3 | Is mastery updated? | `YES at the API layer`; `NO at the AI layer`. The AI's path generator does not call `MasteryService.updateFromAttempt`. | `ai-personalization-audit.md` §1 |
| 4 | Is misconception detection active? | `YES at the API layer`; `NO at the AI layer`. The AI's personality builder calls the LLM to interpret quiz answers; the AI does not author `MisconceptionPattern` rows. | `ai-personalization-audit.md` §1, `ai-memory-audit.md` §2 (AI-MEM-01/05) |
| 5 | Is memory typed? | `NO`. `EpisodicMemory`, `SemanticLearnerMemory`, `ProceduralMemory` are not separate collections; only `memory_type="learning_path"` exists. No `MemoryStatus` lifecycle. No `confidence`, no `evidenceCount`, no `decayAt`. | `ai-memory-audit.md` §1 |
| 6 | Is memory isolated? | `YES by userId` (Qdrant filter), `YES by lessonId` (strict default in `tool_semantic_search`), but `tool_memory_read` without lessonId returns up to 20 unrelated items, and the `tool_semantic_search_with_fallback` is opt-in but logs at WARNING. | `ai-memory-audit.md` §3, §4 |
| 7 | Is RAG scoped? | `NO`. `EmbeddingPipeline.retrieve` accepts a `metadata_filter` parameter but never applies it; `filters = None`. Tenant, publicationStatus, visibility, and entitlement are not enforced at retrieval. | `ai-rag-audit.md` §4 (AI-RAG-04) |
| 8 | Are citations real? | `NO`. `citatetions` is hardcoded empty in `content_pipeline.py:207`, and the field name is misspelled. The tutor endpoint does not pass citations either. The test `test_tutor_citation.py` asserts the deliberately-empty array, giving false confidence. | `ai-rag-audit.md` §6 (AI-RAG-08/09), `ai-evaluation-audit.md` §2 (AI-EVAL-01) |
| 9 | Are tools permissioned? | `NO`. There is no `ToolSpec` registry with `permissionClass`, no `toolsAllowed` per agent, no `budgets`. Tools are bare Python functions. The `FINANCIAL` boundary is vacuously held (the AI has no money route). | `ai-agent-audit.md` §2, §3 |
| 10 | Is agent state persisted? | `PARTIAL`. The router endpoint persists a `DecisionTrace` (with `agentName, agentScope, userId, promptHash, toolCalls, deterministicOutputs`) but does not persist an `Episode` (no `inputTokens, outputTokens, costUsd, latencyMs`, no prompt version, no model version). | `ai-agent-audit.md` §6, §7 |
| 11 | Are episodes persisted? | `NO at the AI layer`. The application API has the `Episode` table. The AI does not call it. The path generator and tutor never write an `Episode` row. | `ai-agent-audit.md` §6, `ai-evaluation-audit.md` §3 |
| 12 | Are decision traces persisted? | `YES (thin)`. The router endpoint writes a `DecisionTrace` row with `agentName, agentScope, userId, promptHash, toolCalls, deterministicOutputs`. It does **not** include `policyVersion, learnerState snapshot, availableActions, selectedAction, reasonCodes` (master prompt §43). | `ai-agent-audit.md` §7, `ai-foundation-audit.md` §5 (AI-FOUND-03) |
| 13 | Is evaluation independent? | `NO`. There is no evaluator, no frozen benchmark, no `LLM-as-judge`. The only existing tests (`test_tutor_citation.py`, `test_rag_recall.py`) assert hardcoded-empty paths. Cohen's κ ≥ 0.85 is not measured. | `ai-evaluation-audit.md` §1, §2 |
| 14 | Is benchmark frozen? | `NO`. There is no `EvaluationDataset`, no `frozen_benchmark.py`, no nightly run. The DSPy preconditions are unmet. | `ai-evaluation-audit.md` §1, `ai-self-improvement-audit.md` §2 |
| 15 | Are prompts versioned? | `NO`. Prompts are inline strings. No `PromptVersion` registry. No `DRAFT` / `EXPERIMENTAL` / `VALIDATED` / `ACTIVE` / `REJECTED` / `ROLLED_BACK` / `ARCHIVED` lifecycle. | `ai-self-improvement-audit.md` §11 |
| 16 | Can candidates be rolled back? | `N/A`. There are no candidates to roll back. The router endpoint has no canary, no traffic split, no rollback flow. | `ai-self-improvement-audit.md` §9, §10 |
| 17 | Can self-improvement run safely? | `NO`. The three loops (master prompt §65) are all missing. No failure mining, no candidate generation, no human approval, no canary. The safety boundary is vacuously satisfied (no production change today). | `ai-self-improvement-audit.md` §1, §13 |
| 18 | Is gamification learning-event-driven? | `YES at the API layer`; the AI is reward-agnostic. The path generator does not mint XP, change streak, or modify leaderboard. The AI does narrate motivation; the RewardEngine validates. The boundary is correct. | `ai-gamification-audit.md` §1, §8 |

## Audit questions not covered above

Master prompt §106 also mentions:

- "Is the tutor actually adaptive?" → question 1 above.
- "Are the architecture documents accurate?" → the 8 per-layer audit documents are evidence-cited from source, not from the architecture documents. Where source and architecture disagree, the audit cites the source.

## Summary scorecard

| Layer | Status |
|---|---|
| AI Foundation | `PARTIAL` (config + types + tests exist; AI-FOUND-01 broken import, AI-FOUND-02/03/04/05/06 gaps) |
| AI Domain | `MISSING` (no ontology, no concept graph, no domain validation in AI) |
| AI Personalization | `MISSING` (L1/L2/L4 missing; L0/L3 partial) |
| AI Memory | `PARTIAL` (Episodic only; no policy, no decay, no privacy filter) |
| AI RAG | `BROKEN` (metadata_filter dead code, citations hardcoded empty, segmentation partial) |
| AI Agent | `PARTIAL` (linear pipeline; no real agent loop; no tool registry; episode missing) |
| AI Evaluation | `MISSING` (no frozen benchmark, no evaluator, no nightly run) |
| AI Self-Improvement | `MISSING` (no optimizer, no prompt versions, no canary, no human approval) |
| AI Gamification | `PARTIAL` (boundary respected; AI narrates only) |

## Required next-step priority

For Phase 0 audit closeout, the immediate wins are:

1. Fix `ai-foundation-audit.md` AI-FOUND-01 (broken `run_curriculum` import — `router_endpoint.py:29` will fail at import time when actually used).
2. Fix `ai-rag-audit.md` AI-RAG-04 (the `metadata_filter` parameter in `EmbeddingPipeline.retrieve` is dead code; tenant isolation cannot be enforced at retrieval).
3. Fix `ai-rag-audit.md` AI-RAG-08/09 (the `citatetions` typo and the hardcoded empty citation array).
4. Add `Idempotency-Key` enforcement on the agent endpoint and the `Signed internal contract` (per `api-business-logic-audit.md` S-3).

The deeper Phase 0 → Phase 1 → Phase 2 work (domain ontology, learner-model ingestion, structured output) is scoped to Phases 2–6 per master prompt §108–§112.

## Cross-references

- `ai-foundation-audit.md`
- `ai-domain-audit.md`
- `ai-personalization-audit.md`
- `ai-memory-audit.md`
- `ai-rag-audit.md`
- `ai-agent-audit.md`
- `ai-evaluation-audit.md`
- `ai-self-improvement-audit.md`
- `ai-gamification-audit.md`
- `docs/audit/agent-architecture-current.md` (existing AI agent audit, pre-existing)
- `docs/strategy/01-verification-delta.md` §VF-* (prior verification delta)
- `api-business-flow-traceability.md` (application-API business flows)
