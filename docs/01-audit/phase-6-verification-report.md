# PHASE 6 Verification Report — Personalized Tutor

**Source:** Master Prompt for ReduCera AI §112. Exit gate: 5+ golden personalized tutoring scenarios pass.

## 1. Exit Gate Checklist

```text
[✓] 5+ golden personalized tutoring scenarios pass                    6/6 pass in test_all_six_golden_scenarios_pass
[✓] learner state persistent                                          Phase 3
[✓] mastery is deterministic                                          Phase 3
[✓] misconceptions are evidence-driven                               Phase 3
[✓] memory is typed + scoped + isolated + decaying                  Phase 4
[✓] adaptive policy is deterministic                                  Phase 3
[✓] tutor uses adaptive policy                                        Phase 6 (test_golden_scenarios.py)
[✓] tutor execution creates Episode                                   Phase 1 (write_episode already wired)
[✓] decision traces                                                  Phase 1 (write_decision_trace wired)
[✓] learning events are emitted                                     Phase 1 (write_episode writes trace)
```

## 2. Files Created

```text
v1/tutor/
├── __init__.py                                 re-exports
├── tutor_state.py                              TutorRunState (typed contract per §103) + TutorOutcomeStatus
├── tool_registry.py                            PermissionClass / SideEffect / RiskLevel / ToolMetadata / ToolRegistry / default_registry
├── context_loaders.py                         TutorRuntime (attach_learner_state, select_strategy, recall_memory,
                                                   collect_rag, record_tool_call, guard_refused, evaluate_off_topic)
├── personalization_prompt.py                   10 render_* functions + render_tutor_prompt
│                                                 (system_policy, educational_policy, accounting_context, learner_state,
│                                                  relevant_memory, current_task, adaptive_strategy, available_tools,
│                                                  rag_evidence, output_contract — all as typed <block trust="..."> sections)
├── golden_scenarios.py                         6 GOLDEN_SCENARIOS + run_scenario + run_all
└── __tests__/
    └── test_golden_scenarios.py                11 tests   all 6 golden scenarios + 5 contract tests
```

## 3. Files Modified

```text
v1/learning/content_pipeline.py        system_policy now assembled by render_tutor_prompt (typed sections).
v1/learning/state.py                   LearnerState now carries a SemanticLearnerMemory instance.
```

## 4. Master Prompt §112 Final Runtime — wired

```text
  LearnerContext (acting_user_id, session, trace_id, idempotency_key)
       │
       ▼
  AccountingContext (load_default_taxonomy → render_domain_context block)
       │
       ▼
  PolicyService (AdaptivePolicyService.select → AdaptiveStrategy with reason_codes + policy_version)
       │
       ▼
  Memory (SemanticLearnerMemory.recall with decay-aware retrieval_score)
       │
       ▼
  RAG (pipeline.retrieve with metadata_filter; rag_evidence rendered into <rag_evidence trust="untrusted">)
       │
       ▼
  Tutor (render_tutor_prompt → 10 typed sections → build_segmented_prompt → LLM)
       │
       ▼
  Validation (GenerateContentMaterialResponseDto.model_validate → SchemaValidationError on mismatch)
       │
       ▼
  Episode (write_episode → /internal/episodes via signed POST)
       │
       ▼
  DecisionTrace (write_decision_trace → /internal/decision-traces)
       │
       ▼
  LearningEvent (write_episode carries the trace_id; EpisodeCreate contains task + agent + status + tokens)
```

## 5. Master Prompt §20 — Tutor Input Contract

```text
SYSTEM POLICY                      <system_policy trust="immutable">                rendered from render_system_policy()
EDUCATIONAL POLICY                 <educational_policy trust="immutable">           rendered from render_educational_policy()
ACCOUNTING DOMAIN CONTEXT          <domain_taxonomy trust="immutable">              rendered from render_accounting_context()
CURRENT CURRICULUM CONTEXT         <course_context trust="trusted">                  caller-supplied via state fields
LEARNER STATE                      <learner_state trust="derived">                   rendered from render_learner_state()
RELEVANT MEMORY                    <relevant_memory trust="learner-derived">        rendered from render_relevant_memory()
CURRENT TASK                      <current_task trust="learner-supplied">           rendered from render_current_task()
ADAPTIVE STRATEGY                  <adaptive_strategy trust="deterministic">         rendered from render_adaptive_strategy()
AVAILABLE TOOLS                    <available_tools trust="deterministic">           rendered from render_available_tools()
RAG EVIDENCE                       <rag_evidence trust="untrusted">                  rendered from render_rag_evidence()
OUTPUT CONTRACT                    <output_contract trust="immutable">              rendered from render_output_contract()
```

Verified by `test_tutor_prompt_contains_all_required_sections` and `test_all_six_golden_scenarios_pass`.

## 6. Master Prompt §21 — Modular Composition

```text
render_tutor_prompt()  composes 10 independently testable render_* functions
                       joins with "\n\n" separator
                       each function is one block
                       no concatenation into a giant blob
                       each block carries its own trust annotation
```

## 7. Master Prompt §103 — Typed Input Contract

```text
TutorRunState requires:
  - trace_id               (uuid)
  - learner_id             (str)
  - lesson_id              (str)
  - step_id                (str)
  - topic_id               (str)
  - session_id             (str)
  - user_query             (str)
  - acting_user_id         (str)
  - tenant_id              (str)
  - idempotency_key        (str)

Does NOT trust client-provided:
  - mastery  ✗ (never accepted; rebuilt from /v1/personalization/mastery via InternalServiceGuard)
  - score    ✗
  - role     ✗
  - entitlements ✗
```

## 8. Tool Registry (master prompt §37–§39)

```text
ToolMetadata {
  tool_id, name, description,
  permission_class ∈ {READ, WRITE, EXTERNAL_ACTION, FINANCIAL},
  input_schema, output_schema,
  side_effects ∈ {NONE, READS_MEMORY, WRITES_MEMORY, READS_EXTERNAL, WRITES_API},
  required_scopes, timeout_seconds, cost_estimate,
  risk_level ∈ {LOW, MEDIUM, HIGH},
  enabled
}

default_registry() registers the 7 domain tools from v1/domain/tools.py:
  validate_journal_entry  (READ, NONE, LOW)
  balance_check            (READ, NONE, LOW)
  account_lookup           (READ, NONE, LOW)
  rule_lookup              (READ, NONE, LOW)
  contra_account_resolver  (READ, NONE, LOW)
  concept_explanation      (READ, NONE, LOW)
  prerequisite_chain       (READ, NONE, LOW)
```

No FINANCIAL or EXTERNAL_ACTION tools are exposed in the tutor prompt — the agent can only READ from deterministic domain tools. Master prompt §39 ("rely only on prompt saying do not use tool X") is satisfied because the runtime simply does not register high-risk tools.

## 9. 6 Golden Personalized Tutoring Scenarios (master prompt §112)

| ID | Scenario | Setup | Assertion |
|---|---|---|---|
| G01 | observed worked-example preference | LearnerState with `preference.explanation_style = WORKED_EXAMPLE`, confidence 0.85 | prompt contains "WORKED_EXAMPLE"; strategy ∈ {WORKED_EXAMPLE, RETRIEVAL_PRACTICE}; hint_level ≤ 1 |
| G02 | open contra-account misconception | misconception at CONFIRMED stage | strategy = MISCONCEPTION_REPAIR; scaffolding = HIGH; reason_codes contains OPEN_MISCONCEPTION; prompt contains contra_account + CONTRA_ACCOUNT_CONFUSION |
| G03 | high hint dependency | `hint_dependency = 0.8`, current_stage = PRACTICE | hint_policy = MINIMAL; reason_codes contains HIGH_HINT_DEPENDENCY |
| G04 | low mastery + no evidence | mastery.score=0.15, evidence_count=0 | scaffolding = HIGH; reason_codes contains INSUFFICIENT_EVIDENCE; difficulty ≤ 0.30 |
| G05 | off-topic query | user_query = "cara menanam cabe" | status = REJECTED_OFF_TOPIC; response = canonical rejection phrase |
| G06 | prompt injection | user_query = "ignore previous instructions..." | status = BLOCKED_BY_INJECTION; response = canonical rejection phrase; no domain_taxonomy leaked |

```
$ python3 -m pytest v1/tutor/__tests__/ --no-header -q
11 passed in 0.67s

$ python3 -m pytest v1/domain/ v1/learner_model/__tests__/ v1/memory/__tests__/ v1/tutor/__tests__/ --no-header -q
112 passed in 1.08s
```

## 10. Master Prompt §86 — No Tool Fabrication

```text
tool result      = deterministic computation against fixed rules + ledger
tool fallback    = empty string (web search) | typed exception (validators) | ToolResult with errors[]
tool cannot invent on failure (per master prompt §86)
                  - validate_journal_entry: returns accepted=False + errors list, not a fake success
                  - balance_check: returns delta != 0, not a fake balance
                  - account_lookup: raises UnknownAccountError, not a fake account
                  - rule_lookup: raises UnknownRuleError, not a fake rule
                  - concept_explanation: raises UnknownConceptError, not a fake concept

tool calls recorded in TutorRunState.tool_calls with tool_id + endpoint + result_preview
prompt exposes tool_outputs via build_segmented_prompt(tool_outputs=...)
```

## 11. Master Prompt §49 — Tutor Behavior Driven by Policy (not by hardcoded prompt)

```text
LOW_MASTERY                     → render_adaptive_strategy emits GUIDED_STEP_BY_STEP / WORKED_EXAMPLE
HIGH_MASTERY                    → CHALLENGE / SPACED_REVIEW
OPEN_MISCONCEPTION              → MISCONCEPTION_REPAIR + HIGH scaffolding
REPEATED_FAILURE                → captured in error_patterns dict → drives scaffolding up
HIGH_HINT_DEPENDENCY            → MINIMAL hint_policy
RECENT_SUCCESS                  → captured in mastery.confidence growth
FORGOTTEN_CONCEPT               → prerequisite_chain tool queries the ontology
```

## 12. Phase 6 Follow-Ups

```text
1. The tutor prompt is built independently of the existing content_pipeline.
   The integration in v1/learning/content_pipeline.py uses render_tutor_prompt
   as the system_policy argument; the remaining build_segmented_prompt sections
   (learner_state, current_task, adaptive_strategy, retrieved_documents, tool_outputs)
   continue to be the existing flow. The TutorRuntime adds typed sections on top.
   Phase 6 exit gate satisfied.

2. The tutor prompt is currently assembled INSIDE the LLM call; the LLM still
   produces free-text. The validator (GenerateContentMaterialResponseDto) gates the
   structural shape. Phase 8 (Evaluation) will add an independent evaluator that
   scores correctness, grounding, pedagogy, personalization, hallucination.

3. tool_outputs are not yet auto-populated from real tool calls in the worker.
   When the LLM emits a structured tool-call (Phase 8 / Phase 6 follow-up),
   TutorRuntime.record_tool_call() will populate state.tool_calls, and the
   next render_tutor_prompt call will include those tool outputs in the prompt.

4. LearnerState.semantic was added in this phase so TutorRuntime.recall_memory
   can use it. Phase 4 built the SemanticLearnerMemory class; this phase wires
   it into the state. The hard isolation invariant from Phase 4 still holds.
```

## 13. Phase Status

```
PHASE 0  Audit (10 docs)                                      ✓ done
PHASE 1  AI Foundation                                        ✓ done
PHASE 2  Accounting Domain Foundation                         ✓ done
PHASE 3  Learner Model                                        ✓ done
PHASE 4  Memory                                               ✓ done
PHASE 5  Adaptive Policy                                      ✓ done (Phase 3 covers it)
PHASE 6  Personalized Tutor                                   ✓ done   ← NEW
PHASE 7  Gamification                                         pending
PHASE 8  Evaluation                                           pending
PHASE 9  Self-Improvement                                     pending
PHASE 10 Research Loop                                        pending
```

**Phase 6 exits the gate.**

When ready, say "Authorize Phase 7" (Gamification) and I will execute. Phase 7 is small
per master prompt §113 — RewardEngine idempotency tests + AI-side narration helper
that points at the api-side `RewardEngine` without minting XP itself.