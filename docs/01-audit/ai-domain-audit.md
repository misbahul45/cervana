# AI Domain Audit — services/ai-api (Accounting Domain Foundation)

**Scope:** Phase 0 master-prompt §108 — Accounting Domain Foundation. Map-and-list depth.
**Audit date:** 2026-10-05.
**Service container:** `reducera_ai_api` :3003. **Source of truth:** `services/api` :3002 (NestJS).
**Evidence rule:** every claim cites a file and line range, or `MISSING` is stated.

---

## 1. Headline Verdict

The `services/ai-api` repository contains **no accounting domain layer**. There is no concept ontology, no prerequisite graph, no misconception taxonomy, no domain validator (double-entry, account-validity, period-validity, rule-validity), no domain tool surface (`validate_journal_entry`, `balance_check`, `account_lookup`, `rule_lookup`, `contra_account_resolver`), no accounting rules module, no `Concept`/`Rule`/`Procedure` entity, no `Misconception` type, and no domain evaluation fixtures. The two LangGraph pipelines (`content_pipeline.py`, `generate_user_steps_pipeline.py`) and the quiz pipeline (`generate_quiz_pipeline.py`) operate on free-form `TopicBase` / `StepBase` / `LessonBase` DTOs fetched from `services/api` and emit either a markdown blob or a `QuizItem[]` array. Domain signal extraction (concepts referenced, principle applied, journal pattern, financial-statement mapping) does **not** happen anywhere. The only accounting terms in the codebase appear as (a) a sample `lessonId` literal in a Pydantic `schema_extra` example, and (b) synthetic text strings inside `v1/learning/__tests__/test_rag_recall.py` used to exercise a generic recall@k benchmark. Neither constitutes a domain model. The tutor is, in domain terms, a content generator with no knowledge of the discipline it is teaching.

## 2. Domain Context Layer (concept ontology, prerequisite relations, concept-level metadata)

| Item | Status | Evidence |
|---|---|---|
| Explicit accounting domain module/package | **MISSING** | no `domain/`, `ontology/`, `accounting/`, `concepts/`, or similar directory anywhere in `services/ai-api`; only `config/`, `utils/`, `v1/`, tests |
| `Concept` entity (id, title, description, domain, etc.) | **MISSING** | no class named `Concept` or any DTO/BaseModel with a `Concept`-like shape in any `.py` file (`grep -rn "class Concept" services/ai-api` returns 0) |
| `ConceptPrerequisite` relation (conceptId, prerequisiteId) | **MISSING** | no class, type, or list field carrying a prerequisite edge; `LPState.steps` (`v1/users_steps/dto.py:201`) is a flat `List[StepBase]` keyed by `sortOrder`, not a DAG |
| `Concept` metadata schema (difficulty, learningObjective, bloomsLevel) | **MISSING** | `StepBase` (`v1/users_steps/dto.py:45-69`) carries only `id, title, description, sortOrder, lessonId, lesson, themeId, theme, quizzes, chat, userSteps, resources, createdAt, updatedAt`; `TopicBase` (`v1/users_steps/dto.py:14-42`) carries curriculum metadata, not concept metadata |
| `ConceptAssessmentSignal` entity | **MISSING** | no field, class, or list of assessment signals anywhere; quiz output is `QuizItem[]` (`v1/users_steps/dto.py:127-136`), a question/options/answer tuple, with no concept linkage |
| `ConceptExample` / `ConceptCounterexample` entities | **MISSING** | no entity; examples live only as inline LLM prompt text in `v1/learning/content_pipeline.py:186-216` and `v1/users_steps/generate_quiz_pipeline.py:111-133` |
| `Rule` entity (id, code, description, appliesTo) | **MISSING** | `grep -rn "class Rule" services/ai-api` returns 0; no rule registry module |
| `Procedure` entity (id, steps, applicability) | **MISSING** | no procedural-memory entity exists; the `tool_memory_upsert` (`utils/tools/memory.py:81-100`) writes free text to a Qdrant memory collection with `memory_type="learning_path"`, with no schema |
| Concept-level mapping between ai-api and `services/api` curriculum entities | **MISSING** | ai-api treats curriculum as opaque `TopicBase`/`StepBase` DTOs; no `Concept` namespace is reconciled with `services/api`'s `Curriculum` Prisma tables |
| Discipline-level domain identifier (e.g. `domain="accounting"`) | **MISSING** | no field on any DTO carries a domain discriminator; `TopicBase` (`v1/users_steps/dto.py:14-42`) has no `domain` field |

## 3. Domain Validation (deterministic rules engine for accounting)

| Item | Status | Evidence |
|---|---|---|
| Double-entry validator (`Σ debits == Σ credits`) | **MISSING** | no function, class, or module named `validate_journal`, `balance_check`, `validate_entry`, or equivalent; `grep -rn "validate_journal\|balance_check\|debits.*credits" services/ai-api` returns 0 in source code (only synthetic fixture text in `v1/learning/__tests__/test_rag_recall.py:13-19`) |
| Valid-account validator (account exists in chart of accounts) | **MISSING** | no `account_lookup` tool, no chart-of-accounts module, no static account registry |
| Valid-direction validator (debit/credit normal-balance rule per account type) | **MISSING** | no code path computes normal-balance direction; no `contra_account_resolver` exists |
| Valid-amount validator (non-negative, decimal-precision, currency unit) | **MISSING** | no money/decimal handling in any DTO; amounts are not represented at all in ai-api |
| Valid-period validator (transaction falls in an open period) | **MISSING** | no period concept exists in ai-api |
| Valid-rule validator (transaction satisfies a domain rule by id) | **MISSING** | no rule registry; no `rule_lookup` tool |
| `AccountingEngineService` (mirror of `services/api` engine) | **MISSING** | no class or module with that name; `grep -rn "AccountingEngineService" services/ai-api` returns 0; the master-prompt reference to that engine has no counterpart here |
| Cross-service typed call to `services/api` accounting engine | **MISSING** | outbound calls in `v1/users_steps/service.py` and `v1/learning/service.py` are limited to `curriculum/*`, `learning/*`, `chat/*` — none target an accounting engine endpoint |
| Post-generation schema check (LLM output structurally valid) | PRESENT but narrow | `pipeline.llm.with_structured_output(QuizResponse)` is the only post-parse validator (`v1/users_steps/generate_quiz_pipeline.py:147-151`); it validates question/options/answer shape, never the accounting correctness of the answer |

## 4. Domain Graph / ConceptGraph (typed entity layer)

| Item | Status | Evidence |
|---|---|---|
| `Concept` entity | **MISSING** | none of `v1/learning/dto.py`, `v1/users_steps/dto.py`, `v1/resources/dto.py`, `v1/agents/router_endpoint.py` define a `Concept` model; `v1/users_steps/dto.py:14-210` is the entire DTO surface and contains none of the required entities |
| `ConceptPrerequisite` entity | **MISSING** | same as above; no edge type, no adjacency list, no prerequisite table |
| `ConceptMisconception` entity | **MISSING** | not defined; no class, no dict shape with `id, conceptId, type, confidence, evidenceCount, firstObservedAt, lastObservedAt, status, resolutionEvidence` |
| `ConceptAssessmentSignal` entity | **MISSING** | no entity; quiz output is `QuizItem` (`v1/users_steps/dto.py:127-136`), which carries `question, type, difficulty, options, answer` and no concept reference |
| `ConceptExample` entity | **MISSING** | not defined |
| `ConceptCounterexample` entity | **MISSING** | not defined |
| `Rule` entity | **MISSING** | not defined |
| `Procedure` entity | **MISSING** | not defined |
| ConceptGraph aggregate (set of the above with edges) | **MISSING** | no in-memory graph, no Neo4j/Postgres storage, no `ConceptGraph` import anywhere |
| Persistence layer for concept graph | **MISSING** | ai-api has no database — it reads `services/api` over HTTP (`v1/learning/service.py:13-86`, `v1/users_steps/service.py:6-97`, `v1/resources/service.py:18-25`) and writes only to Qdrant (`utils/tools/memory.py:81-100`, `v1/resources/workers.py:60-64`) and Redis-backed Celery (`config/celery.py:25-34`) |

## 5. Misconception Taxonomy

| Item | Status | Evidence |
|---|---|---|
| `Misconception` type with required field set (`id, conceptId, type, confidence, evidenceCount, firstObservedAt, lastObservedAt, status, resolutionEvidence`) | **MISSING** | no class, Pydantic model, or TypedDict carrying these fields anywhere in `services/ai-api`; full repo grep confirms zero matches |
| Misconception detection from tutor runs | **MISSING** | neither `v1/learning/content_pipeline.py` (`:264-271`) nor `v1/users_steps/generate_user_steps_pipeline.py:25-397` nor `v1/users_steps/generate_quiz_pipeline.py:11-165` extracts misconception signals from learner interaction; the content pipeline writes a free-form markdown blob (`v1/learning/content_pipeline.py:226-238`) and the quiz pipeline writes a `QuizResponse` (`v1/users_steps/generate_quiz_pipeline.py:147-155`) — neither carries per-learner misconception evidence |
| Misconception storage endpoint on `services/api` | **MISSING (in ai-api)** | ai-api never POSTs to any `/misconception` or equivalent endpoint on `services/api`; `grep -rn "misconception" services/ai-api` returns 0 in source code |
| Misconception catalogue (static taxonomy for the accounting domain) | **MISSING** | no `accounting_misconceptions.yaml`, no hard-coded list, no JSON taxonomy file in the repo |
| Resolution evidence tracking | **MISSING** | no field, no endpoint, no DB row carries `resolutionEvidence` |
| Confidence calibration (Bayesian update per evidence) | **MISSING** | no numerical confidence model; the only confidence-like number in the entire service is `r.get("score", 0.0)` returned by Qdrant retrievals (`v1/learning/content_pipeline.py:128-133`), which is a vector similarity score, not a Bayesian concept-mastery posterior |

## 6. Accounting Tool Interfaces (LLM-callable tools)

| Item | Status | Evidence |
|---|---|---|
| `validate_journal_entry` tool | **MISSING** | no such function or class; `grep -rn "validate_journal" services/ai-api` returns 0 |
| `balance_check` tool | **MISSING** | no such function or class; `grep -rn "balance_check" services/ai-api` returns 0 |
| `account_lookup` tool | **MISSING** | no such function or class |
| `rule_lookup` tool | **MISSING** | no such function or class |
| `contra_account_resolver` tool | **MISSING** | no such function or class |
| Tool registration surface (e.g. LangChain `@tool` list) | **MISSING** | no `@tool` decorator or `StructuredTool` registration in any source file; the only callable tool-like helpers are `tool_memory_upsert`, `tool_semantic_search`, `tool_semantic_search_with_fallback`, `tool_memory_read` (`utils/tools/memory.py:13-132`) and `tool_web_search` (`utils/tools/web_search.py:13-46`), none of which are accounting-domain tools |
| Tool-call surface declared to LLM in prompts | **MISSING** | prompts in `v1/learning/content_pipeline.py:186-216` and `v1/users_steps/generate_quiz_pipeline.py:60-141` do not list any callable tools to the model; the tutor cannot invoke domain tools at all |

## 7. Accounting Rules / Validators Module

| Item | Status | Evidence |
|---|---|---|
| `accounting_rules.py` or equivalent rules module | **MISSING** | no such file anywhere under `services/ai-api/`; the full module tree is `config/`, `utils/`, `v1/`, with no `domain/` or `accounting/` subtree |
| `validators/journal.py` or equivalent journal validator | **MISSING** | no `validators/` directory; no journal validator |
| Static account catalog (e.g. `accounts.json`) | **MISSING** | no JSON/YAML/TOML fixture file holding a chart of accounts |
| Normal-balance table (debit/credit per account type) | **MISSING** | no such table; no dict constant in `services/ai-api/config/*` |
| Period calendar / fiscal-period model | **MISSING** | no time-period concept; the only time references are `createdAt`/`updatedAt` on DTOs (`v1/users_steps/dto.py:35-36, 64-68`) and the Celery worker scheduling (`config/celery.py:38-47`) |
| Rule versioning / `Rule.version` | **MISSING** | no Rule entity, no version field |
| Validator registered in Celery task | **MISSING** | `config/celery.py:29-33` only includes `v1.resources.workers`, `v1.users_steps.workers`, `v1.learning.workers`; no domain validator worker |

## 8. Domain Evaluation Cases

| Item | Status | Evidence |
|---|---|---|
| Evaluation fixture file (e.g. `eval/accounting_cases.json`) | **MISSING** | no `eval/`, `fixtures/`, `cases/`, or `domain_evaluation/` directory; `services/ai-api` has no evaluation suite at all |
| `pytest.mark.domain_accounting` collection | **MISSING** | only markers found via `grep -rn "@pytest.mark" services/ai-api` are none — there are no markers in test files |
| Golden test cases for double-entry, account-validity, normal-balance | **MISSING** | no such fixtures; `services/ai-api/v1/learning/__tests__/test_rag_recall.py:13-34` contains 20 synthetic RAG chunks whose `text` strings describe accounting concepts, but the file is a **retrieval recall@k benchmark** (`test_rag_recall.py:87-101`), not a domain-correctness eval. Its assertions compare retrieved chunk ids against expected chunk ids; they do not check whether the accounting content itself is correct |
| Falsifiable accounting case (entry, expected validator verdict) | **MISSING** | no test asserts that a journal entry with unbalanced debits/credits is rejected; no test asserts that a debit to a liability is rejected |
| Falsifiable misconception case (learner answer, expected misconception id) | **MISSING** | no such fixture |
| Falsifiable concept-prerequisite case (step A, expected required step B) | **MISSING** | no such fixture |
| Frozen regression set for accounting tasks | **MISSING** | only the generic RAG recall set exists (`test_rag_recall.py:36-57`); it has no accounting semantics, only retrieval-recall semantics |

## 9. Domain Signal Extraction from Tutor Runs

| Item | Status | Evidence |
|---|---|---|
| Extract `concepts_referenced` from a tutor run | **MISSING** | `v1/learning/content_pipeline.py:152-251` stores `state.generate = {chatId, chatMessageId, data, citations, metadata: {topicId, lessonId, stepId, userStepId, userId}}` — no `concepts_referenced` field; no parsing of the LLM output for concept ids |
| Extract `principle_applied` from a tutor run | **MISSING** | not extracted; the LLM prompt (`v1/learning/content_pipeline.py:186-216`) never asks the model to enumerate accounting principles |
| Extract `journal_pattern` from a tutor run | **MISSING** | not extracted; no journal entry is ever generated by the tutor — only learning prose |
| Extract `financial_statement_mapping` from a tutor run | **MISSING** | not extracted; the LLM output is free-form markdown with section headers like `Mengapa Hal Ini Penting, Materi Inti, Contoh Praktik di Dunia Kerja, Latihan Singkat (3-5 soal), Ringkasan Kunci (3-7 poin)` (`v1/learning/content_pipeline.py:210-214`), with no enforced balance-sheet / income-statement / cash-flow tagging |
| Extract domain signals from quiz answers | **MISSING** | `v1/users_steps/generate_quiz_pipeline.py:147-155` returns `QuizResponse(quiz=[])` on parse failure, and on success returns `QuizResponse(quiz=[QuizItem(...)])`; no per-answer concept id, no misconception signal, no rule id, no `principle_applied` field on the `QuizItem` schema (`v1/users_steps/dto.py:127-136`) |
| Store extracted signals to `services/api` over HTTP | **MISSING** | no outbound POST in `v1/learning/workers.py:13-104` or `v1/users_steps/workers.py:5-43` carries concept/misconception/rule fields; the only POST is `create_content_material` (`v1/learning/service.py:78-85`) and `create_personality_quiz` (`v1/users_steps/service.py:54-68`) |
| Persist extracted signals to local store | **MISSING** | only `tool_memory_upsert` (`utils/tools/memory.py:81-100`) writes, and it writes free-form text into a Qdrant memory collection with no schema for domain signals |
| Surface extracted signals to downstream episodes/decisions | **MISSING** | no `Episode` row, no `DecisionTrace` row is written by either tutor pipeline (see `ai-foundation-audit.md` §10 for the broader `Episode`/`DecisionTrace` gap) |

## 10. Cross-Cutting: Tutor Pipeline Domain Awareness

| Item | Status | Evidence |
|---|---|---|
| Tutor prompt names the discipline (accounting) | **MISSING** | the system prompt in `v1/learning/content_pipeline.py:188-198` is `"Anda adalah Pakar Materi Sertifikasi Profesi. ..."`; it is discipline-agnostic. The system prompt in `v1/users_steps/generate_quiz_pipeline.py:60-90` is `"Anda adalah **Professional Certification Exam Developer**. ..."`; also discipline-agnostic |
| Tutor prompt enforces a domain-specific section schema | **MISSING** | `v1/learning/content_pipeline.py:210-214` requires generic sections (`Mengapa Hal Ini Penting, Materi Inti, Contoh Praktik di Dunia Kerja, Latihan Singkat, Ringkasan Kunci`); no `accounting_equation`, `journal_entry`, `trial_balance`, or `financial_statement` heading required |
| Quiz prompt enforces discipline-specific question types | **MISSING** | `v1/users_steps/generate_quiz_pipeline.py:60-141` allows `multiple_choice, input, matching, scenario` (`v1/users_steps/dto.py:127-136`); no `journal_entry_construction` or `account_classification` question type |
| Quiz example in prompt references accounting | PRESENT but only in example | `v1/users_steps/generate_quiz_pipeline.py:125-132` has a single `<example_style>` block that mentions "rekonsiliasi", "Buku Besar", "Rekening Koran", "jurnal koreksi" — narrative example text only, with no schema and no enforcement |
| Quiz prompt asks model to enumerate the principle / concept tested | **MISSING** | `QuizItem` (`v1/users_steps/dto.py:127-136`) has no `conceptId`, `principleId`, or `ruleId` field; the example in the prompt mentions "Materi Step 3: Crisis Mgmt" but the schema does not capture that reference |
| Cross-pipeline domain vocabulary consistency | **MISSING** | the content pipeline and the quiz pipeline each invent their own heading sets; there is no shared vocabulary file; `v1/learning/content_pipeline.py:210-214` and `v1/users_steps/generate_quiz_pipeline.py:95-102` do not share a section schema |
| Domain-aware retrieval filter | **MISSING** | `pipeline.retrieve(metadata_filter={"source": "material"}, top_k=10)` (`v1/learning/content_pipeline.py:118`) and `pipeline.retrieve(query=summary, top_k=10)` (`v1/users_steps/generate_quiz_pipeline.py:53`) only filter by `source` (RAG collection source string), never by `domain` or `conceptId`; `config/embedding_pipeline.py:241-253` builds filters but no caller passes a domain filter |

## 11. Evidence Trail Summary

| Cluster (grep) | Files | What's confirmed |
|---|---|---|
| `grep -rn "class Concept\|class Misconception\|class Rule\|class Procedure\|class AccountingEngine"` | full `services/ai-api/` tree (61 `.py` files) | 0 matches — no domain entity classes exist |
| `grep -rn "validate_journal\|balance_check\|account_lookup\|rule_lookup\|contra_account"` | full `services/ai-api/` tree | 0 matches in source code; matches only in synthetic fixture text in `v1/learning/__tests__/test_rag_recall.py:13-19, 36-56` |
| `grep -rn "evidence_count\|firstObserved\|lastObserved\|misconceptionType\|resolutionEvidence"` | full `services/ai-api/` tree | 0 matches anywhere |
| `grep -rn "domain\|ontology\|conceptGraph"` | full `services/ai-api/` tree | 1 false-positive match — `test_subdomain_does_not_match` at `config/__tests__/test_url_allowlist.py:82` (URL host subdomain, not domain ontology) |
| `grep -rn "accounting\|debit\|credit\|journal"` | full `services/ai-api/` tree | 23 matches — all in (a) `v1/learning/dto.py:39` sample `lessonId` literal, (b) `v1/learning/__tests__/test_rag_recall.py` synthetic RAG corpus text, (c) `config/__tests__/test_prompt_segmentation.py:16, 36, 43, 133, 169, 187` prompt-segmentation fixture text. Zero source-code domain models |
| `grep -rn "@pytest.mark"` | full `services/ai-api/` tree | 0 matches — no test markers anywhere; no `domain_accounting` marker |
| `find services/ai-api -name "*.py"` | `services/ai-api/` excluding `.venv`, `__pycache__`, `.pytest_cache` | 61 `.py` files inspected; no `domain/`, `ontology/`, `accounting/`, `validators/`, `concepts/`, `eval/` directory exists |
| `v1/learning/dto.py` (full read) | `v1/learning/dto.py:1-122` | DTO surface is `CitationDto`, `GenerateContentMaterialResponseDto`, `UserStepBase`, `LessonBase`, `GenerateContentMaterialPipeline` — none are domain entities |
| `v1/users_steps/dto.py` (full read) | `v1/users_steps/dto.py:1-210` | DTO surface is `TopicBase`, `StepBase`, `LearningStyleProfileBase`, `GenerateQuestionPipeline`, `PersonalityQuiz*`, `QuizItem`, `QuizResponse`, `BaseUserStep`, `GenerateUserStepRespon`, `LPState` — none are domain entities; `QuizItem` is the only "signal" type and carries no concept id |
| `v1/learning/content_pipeline.py` (full read) | `v1/learning/content_pipeline.py:1-271` | Three-node LangGraph (`parallel_fetch` → `prepare_learning_context` → `generate_material`); final `state.generate` is a generic dict, no domain signals |
| `v1/users_steps/generate_user_steps_pipeline.py` (full read) | `v1/users_steps/generate_user_steps_pipeline.py:1-397` | Seven-node LangGraph for learning-path generation; output is `GenerateUserStepRespon` (`v1/users_steps/dto.py:147-148`); no concept/misconception/rule extraction |
| `v1/users_steps/generate_quiz_pipeline.py` (full read) | `v1/users_steps/generate_quiz_pipeline.py:1-165` | Three-node LangGraph; final `analyze_text` returns `QuizResponse`; no domain signal extraction |
| `v1/agents/curriculum_agent.py` (full read) | `v1/agents/curriculum_agent.py:1-50` | Deterministic HTTP shim: GET `/v1/personalization/policy/next`, GET `/v1/personalization/memory`, POST `/v1/personalization/memory`; none of these are accounting-domain endpoints |
| `config/embedding_pipeline.py` (full read) | `config/embedding_pipeline.py:1-275` | Qdrant + HuggingFace + OpenAI wrapper; metadata_filter accepts arbitrary `dict` but no caller passes a `domain` or `conceptId` filter; `Upsert` accepts arbitrary metadata and persists it as JSON |

## 12. Critical Defects (domain layer)

| Severity | Defect | Location |
|---|---|---|
| CRITICAL | No `Concept` / `ConceptPrerequisite` / `ConceptMisconception` / `ConceptAssessmentSignal` / `ConceptExample` / `ConceptCounterexample` / `Rule` / `Procedure` entity | absent from `v1/learning/dto.py`, `v1/users_steps/dto.py`, `v1/resources/dto.py`; absent from any other module |
| CRITICAL | No `Misconception` type with required field set (`id, conceptId, type, confidence, evidenceCount, firstObservedAt, lastObservedAt, status, resolutionEvidence`) | absent from entire `services/ai-api/` tree |
| CRITICAL | No double-entry, valid-account, valid-direction, valid-amount, valid-period, or valid-rule validator | no `validators/` module, no `accounting_rules.py`, no `AccountingEngineService` mirror |
| CRITICAL | No accounting tool surface (`validate_journal_entry`, `balance_check`, `account_lookup`, `rule_lookup`, `contra_account_resolver`) | no `@tool`-decorated functions for accounting anywhere |
| CRITICAL | No domain signal extraction from tutor runs (`concepts_referenced`, `principle_applied`, `journal_pattern`, `financial_statement_mapping`) | `v1/learning/content_pipeline.py:226-238` writes a generic dict; `v1/users_steps/generate_quiz_pipeline.py:147-155` returns `QuizResponse`; no field in either schema carries the required signal |
| HIGH | No domain evaluation cases (no `eval/` directory, no fixtures, no markers) | absent from entire tree |
| HIGH | Quiz output schema lacks any concept/principle/rule linkage | `QuizItem` at `v1/users_steps/dto.py:127-136` |
| HIGH | Tutor prompts are discipline-agnostic | `v1/learning/content_pipeline.py:188-198`; `v1/users_steps/generate_quiz_pipeline.py:60-90` |
| HIGH | Retrieval filter has no `domain` or `conceptId` field | `v1/learning/content_pipeline.py:118`; `v1/users_steps/generate_quiz_pipeline.py:53`; `config/embedding_pipeline.py:241-253` accepts arbitrary `metadata_filter` dict but no caller uses a domain filter |
| MEDIUM | No chart-of-accounts, normal-balance table, period calendar, or rule catalogue | no JSON/YAML fixture file anywhere |
| MEDIUM | The accounting terms in the codebase are in test fixtures and Pydantic `schema_extra` examples, not in production code | `v1/learning/dto.py:39`; `v1/learning/__tests__/test_rag_recall.py:13-34`; `v1/learning/__tests__/test_tutor_citation.py:24, 32`; `config/__tests__/test_prompt_segmentation.py:16, 36, 43, 133, 169, 187` |
| MEDIUM | Quiz example prompt mentions "rekonsiliasi", "Buku Besar", "Rekening Koran", "jurnal koreksi" but the surrounding `QuizItem` schema cannot capture the principle or the rule | `v1/users_steps/generate_quiz_pipeline.py:125-132` vs `v1/users_steps/dto.py:127-136` |

## 13. What Phase 2 Must Build (domain layer)

```text
1.  services/ai-api/v1/domain/__init__.py                                  — package init
2.  services/ai-api/v1/domain/concept.py                                   — Concept, ConceptPrerequisite,
                                                                              ConceptAssessmentSignal,
                                                                              ConceptExample, ConceptCounterexample
                                                                              Pydantic models (id, code, title,
                                                                              description, domain, difficulty,
                                                                              bloomsLevel, learningObjective,
                                                                              relatedAccountTypes, relatedRuleIds)
3.  services/ai-api/v1/domain/misconception.py                             — Misconception Pydantic model with
                                                                              (id, conceptId, type, confidence,
                                                                              evidenceCount, firstObservedAt,
                                                                              lastObservedAt, status,
                                                                              resolutionEvidence); plus the
                                                                              static accounting misconception
                                                                              catalogue as a JSON file
4.  services/ai-api/v1/domain/rule.py                                      — Rule, RuleVersion Pydantic models
5.  services/ai-api/v1/domain/procedure.py                                — Procedure, ProcedureStep Pydantic models
6.  services/ai-api/v1/domain/chart_of_accounts.py                         — static chart-of-accounts registry
                                                                              (account code, name, type,
                                                                              normal_balance) loaded from
                                                                              data/accounting/coa.json
7.  services/ai-api/v1/domain/validators/__init__.py
8.  services/ai-api/v1/domain/validators/journal.py                        — validate_journal_entry(entries) →
                                                                              debits == credits, all accounts
                                                                              exist, all directions match
                                                                              normal balance, all amounts > 0
9.  services/ai-api/v1/domain/validators/balance.py                        — balance_check(account_code,
                                                                              period) → (debit_total,
                                                                              credit_total, balance)
10. services/ai-api/v1/domain/validators/period.py                         — assert_period_open(period_id)
11. services/ai-api/v1/domain/tools/validate_journal_entry.py              — @tool for the LangChain tool surface
12. services/ai-api/v1/domain/tools/balance_check.py                       — @tool
13. services/ai-api/v1/domain/tools/account_lookup.py                      — @tool
14. services/ai-api/v1/domain/tools/rule_lookup.py                         — @tool
15. services/ai-api/v1/domain/tools/contra_account_resolver.py              — @tool
16. services/ai-api/v1/domain/signals/extract.py                           — extract_signals(tutor_run) →
                                                                              {concepts_referenced,
                                                                              principle_applied, journal_pattern,
                                                                              financial_statement_mapping,
                                                                              misconceptions_observed,
                                                                              rules_violated}; called at the
                                                                              end of content_pipeline,
                                                                              generate_quiz_pipeline, and
                                                                              generate_user_steps_pipeline
17. services/ai-api/v1/domain/signals/persist.py                           — POST extracted signals to
                                                                              services/api /v1/domain/concepts/observe
                                                                              and /v1/domain/misconceptions/observe
                                                                              with idempotency key
18. services/ai-api/data/domain/accounting/                                 — directory for static fixtures
19. services/ai-api/data/domain/accounting/coa.json                        — chart of accounts (>= 50 accounts:
                                                                              assets, liabilities, equity,
                                                                              revenue, expense)
20. services/ai-api/data/domain/accounting/normal_balance.json             — normal balance per account type
21. services/ai-api/data/domain/accounting/rules.json                      — rule catalogue (id, code,
                                                                              description, applies_to, version)
22. services/ai-api/data/domain/accounting/misconceptions.json             — static misconception catalogue
23. services/ai-api/data/domain/accounting/eval/                           — domain evaluation fixtures
24. services/ai-api/data/domain/accounting/eval/journal_entries.jsonl      — 30+ golden journal entries
                                                                              (balanced + unbalanced + invalid)
                                                                              with expected validator verdicts
25. services/ai-api/data/domain/accounting/eval/misconceptions.jsonl       — 20+ golden misconception cases
                                                                              (learner answer + expected
                                                                              misconception id + confidence)
26. services/ai-api/data/domain/accounting/eval/prerequisites.jsonl       — 15+ golden prerequisite cases
27. services/ai-api/v1/domain/__tests__/test_journal_validator.py          — unit tests for validate_journal_entry
28. services/ai-api/v1/domain/__tests__/test_balance_check.py
29. services/ai-api/v1/domain/__tests__/test_account_lookup.py
30. services/ai-api/v1/domain/__tests__/test_rule_lookup.py
31. services/ai-api/v1/domain/__tests__/test_signal_extraction.py          — asserts concepts_referenced,
                                                                              principle_applied, journal_pattern,
                                                                              financial_statement_mapping appear
                                                                              on tutor-run output schema
32. services/ai-api/v1/domain/__tests__/test_domain_eval.py                — runs the JSONL fixtures and
                                                                              asserts pass rate >= 95%
33. Update services/ai-api/v1/learning/content_pipeline.py                 — call extract_signals() before
                                                                              state.generate is finalized;
                                                                              POST signals to /v1/domain/* on
                                                                              services/api
34. Update services/ai-api/v1/users_steps/generate_quiz_pipeline.py        — add conceptId, principleId,
                                                                              ruleId to QuizItem schema;
                                                                              call extract_signals() on the
                                                                              generated quiz; POST signals
35. Update services/ai-api/v1/users_steps/generate_user_steps_pipeline.py  — call extract_signals() on the
                                                                              generated learning path; POST
                                                                              signals
36. Update services/ai-api/config/embedding_pipeline.py                    — extend metadata filter to accept
                                                                              domain and conceptId; ensure
                                                                              every upsert tags domain=
37. Update services/ai-api/v1/learning/dto.py                              — add domain field to
                                                                              GenerateContentMaterialPipeline,
                                                                              add a SignalOutputDto
38. Add a domain-aware prompt template module
    services/ai-api/config/prompts/accounting.py                          — section schema that includes
                                                                              journal entry, trial balance,
                                                                              and financial statement headings
39. Add a domain-aware quiz prompt template
    services/ai-api/config/prompts/accounting_quiz.py                     — question types:
                                                                              journal_entry_construction,
                                                                              account_classification, etc.
40. Add typed output schema for the tutor that includes the
    four domain signals: concepts_referenced (List[str]),
    principle_applied (str), journal_pattern (Optional[str]),
    financial_statement_mapping (List[str])
```
