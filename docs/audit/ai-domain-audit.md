# AI Domain Audit

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-04`
>
> Inventory and assessment of the AI service's accounting-domain layer. Master prompt §6–§10 require a dedicated domain layer. Source: `services/ai-api/` at HEAD `a868095`.

## 1. Required inventory (master prompt §7–§9)

| Item | Status | Evidence |
|---|---|---|
| Domain ontology | `MISSING` | no `domain/` package; no `concepts` table; no `Concept`, `Misconception`, `Procedure` models |
| Concept graph | `MISSING` | no `prerequisite` relations; no `EXEMPLIFIED_BY`, `MISCONCEPTION_OF`, `ASSESSED_BY` relations |
| Prerequisite relations | `MISSING` at the AI layer | the application API has `SubTopicPrerequisite` (reducera-v1); AI does not consume it |
| Domain rules | `MISSING` | no `domain/rules`; no Debit = Credit validator at the AI side |
| Procedures | `MISSING` | no structured journal procedure at the AI side; the application API's `AccountingEngineService` is the authoritative implementation (per CLAUDE.md and api-business-flow-traceability.md) |
| Examples / counterexamples | `MISSING` | none in source |
| Common misconceptions | `MISSING` at the AI layer | `MisconceptionPattern` exists in the application API schema (api-business-flow-traceability.md BF-001) but AI does not author or query it |
| Problem types | `MISSING` | none |
| Learning objectives | `MISSING` | none |
| Assessment signals | `MISSING` | none |

The AI service has **no accounting-domain abstraction**. The application API is the source of accounting truth per CLAUDE.md.

## 2. Domain context in the prompt

`v1/learning/content_pipeline.py` (lines 169–200) constructs the `generate_material` prompt with a generic "Pakar Materi Sertifikasi Profesi" system message and an educational policy. There is no concept-id, no misconception lookup, no prerequisite check. The RAG is queried with `metadata_filter={"source": "material"}` (line 94 in service.py) — only the source field, no topic/concept filter.

The `tutor` (curriculum_agent) prompt at `v1/users_steps/generate_user_steps_pipeline.py:259–333` is generic "Learning Path Master Agent" with no domain context.

## 3. Domain validation in the AI service

None. The AI service does not validate:

- `Debit = Credit` for journal entries (only the application API's `AccountingEngineService` does)
- valid account
- valid direction
- valid amount
- valid period
- valid business rule

The LLM-generated text is sent to the application API verbatim (e.g., `create_message_chat`, `create_content_material`). Master prompt §10 says the AI can propose, the deterministic engine judges mechanics. The current code does not call any deterministic engine.

## 4. Domain misuses observed

- AI-DOMAIN-01: `generate_material` calls `tool_web_search` (line 102) and feeds the response into the prompt with no domain allow-list. A malicious web page can inject "ignore all instructions" text. The `prompt_segmentation.looks_like_instruction` test covers the regex but the segmentation is **not applied in the generate-material flow** (`content_pipeline.py:152-200` calls `segment_retrieved` for RAG and web but does not wrap user input or the LLM output in a trust fence). Severity: HIGH (per master prompt §27, RAG injection).
- AI-DOMAIN-02: `node_semantic_search` in `generate_user_steps_pipeline.py:117-128` uses `tool_semantic_search` (strict lesson scope, good) but `node_external_search` uses `tool_web_search` with no scope. Severity: MEDIUM.
- AI-DOMAIN-03: no domain validator is reachable from the agent endpoint. The agent returns `result` to the router_endpoint which forwards it as JSON. The application API has no validator for the `tutor_response` shape. Severity: HIGH.
- AI-DOMAIN-04: domain context (`Mastery Topic: {getattr(state, 'topic_mastery', 'unknown')}`) silently accepts `unknown` when mastery is not loaded. Master prompt §6 says mastery is first-class; the AI tolerates its absence. Severity: MEDIUM.
- AI-DOMAIN-05: domain on the LLM is expressed in Indonesian (`build_segmented_prompt` uses `Bahasa Indonesia profesional`), but the application API's authoritative grading runs in English (Prisma column names). The AI is monolingual; the API is multilingual. Severity: LOW.
- AI-DOMAIN-06: no concept-id is passed from AI to API. The agent proposes a learning path; the API stores `stepTemplateId` (UUID) but the link from the path-step to the accounting concept is implicit. Master prompt §8 requires a structured concept metadata. Severity: HIGH.

## 5. Summary scorecard (AI-DOMAIN)

| Area | Status |
|---|---|
| Domain ontology | `MISSING` |
| Concept graph | `MISSING` (at AI layer; present at API layer) |
| Prerequisite relations | `MISSING` (at AI layer) |
| Domain rules | `MISSING` (only at API layer) |
| Procedures | `MISSING` (only at API layer) |
| Examples / counterexamples | `MISSING` |
| Common misconceptions | `MISSING` (at AI layer) |
| Problem types | `MISSING` |
| Learning objectives | `MISSING` |
| Assessment signals | `MISSING` |
| Domain validation in AI | `MISSING` |
| Domain concepts in prompt | `MISSING` (generic) |
| Concept-to-LLM bridging | `MISSING` |
| Bilingualism (ID/EN) | `MISSING` at AI |

## 6. Required next-step

For Phase 2 (Accounting Domain Foundation), the AI needs to:

1. Add `domain/` package with `concepts.json`, `prerequisites.json`, `misconceptions.json`.
2. Add `domain_context` typed section to `build_segmented_prompt` so the LLM sees structured concept id + prerequisite + misconception + known-examples.
3. Add `domain_validator` per concept (e.g. `validate_journal_proposal(journal) -> ValidationResult`) and call it from the agent endpoint before returning.
4. Wire `SubTopicPrerequisite` and `TopicMasteryRecord` consumption from the application API into the agent's prompt, replacing the silent `unknown` fallback.

These changes are scoped to Phase 2 per master prompt §108.

## 7. Cross-references

- `ai-foundation-audit.md`
- `ai-personalization-audit.md`
- `ai-memory-audit.md`
- `ai-rag-audit.md`
- `ai-agent-audit.md`
- `api-business-flow-traceability.md` BF-001, BF-019
