# Domain Audit — Accounting Engine and Domain Abstraction

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-09`
>
> Which parts of the system are a generic learning engine, which are accounting, and whether accounting truth is deterministic.

---

## Scope

The accounting sandbox and simulator in `services/api`, the Python domain package in `services/ai-api/v1/domain`, the ontology data on both sides, and every place where accounting wording or structure is hard-coded into supposedly generic code. Target architecture: Learning Core + Domain Adapter, with Accounting as the first adapter.

## Findings

### Abstraction layer

| Item | Status | Evidence |
|---|---|---|
| `DomainAdapter` interface, `DomainRegistry`, `DomainContext`, `domain_id` | `MISSING` | grep for `DomainAdapter`, `DomainRegistry`, `domain_id`, `domainId`, `DomainContext` over `services/` and `apps/` returns no file |
| Domain column on content, chunks or events | `MISSING` | no `domain` field in the Qdrant payloads sampled; Prisma models for `Topic`, `Episode`, `LearningEvent` carry none (grep above) |
| Generic types for concept, rule, procedure, misconception, graph | `PARTIAL` | `services/ai-api/v1/domain/{concept,rule,procedure,misconception,graph}.py` have no accounting terms in their names, but the only data loader and the only graph content are accounting |

### Where accounting is hard-coded

| Location | Accounting-specific content | Layer it sits in |
|---|---|---|
| `services/ai-api/v1/tutor/personalization_prompt.py:12,30` | "Tutor Akuntansi ReduCera", "istilah akuntansi" | tutor (intended generic) |
| `services/ai-api/v1/learning/content_pipeline.py:345-347` | "mekanika akuntansi (debit/credit, normal balance, contra account)" | learning pipeline |
| `services/ai-api/v1/domain/{validators,tools,data}/` | account types, journal, period, amount, direction validators; 6 accounting tools; 13-id taxonomy | domain (correctly isolated) |
| `services/api/src/v1/sandbox/`, `simulator/`; models `Sandbox*`, `VirtualCompany`, `JournalEntry`, `Ledger`, `FinancialStatement` | accounting engine | api (correctly isolated) |
| `apps/web/nuxt.config.ts:7-18` | site title, meta, keywords are accounting | web |
| `services/api/prisma/seed-data/golden-accounting-graph.json` | 4 levels, 65 topics, 64 prerequisite edges | data |

The learning engine (mastery, policy, memory, evaluation) does not import accounting modules, with one exception: `v1/learner_model/{mastery,misconception,llm_signal}.py` import `v1.domain.misconception` for status enums. Accounting wording enters through prompt text, not through code dependencies.

### Accounting authority

| Feature | Status | Source | Notes |
|---|---|---|---|
| Journal validation (debits = credits and rule checks) | `IMPLEMENTED` | `services/api/src/v1/sandbox/accounting-sandbox.service.ts:38` `validateJournal`, route `POST /sandbox/journal/validate` (`sandbox.controller.ts:50-113`) | pure, deterministic; `engine-property.spec.ts` passes |
| Scenario answer key hidden from clients | `IMPLEMENTED` | `sandbox.controller.ts:40` strips `expectedLines` | `scenario-answer-key.spec.ts` passes |
| Persisted attempts: `postJournal`, `trialBalance`, `closePeriod` | `UNWIRED` | `accounting-sandbox.service.ts:69,128,174` | `SandboxController` has three routes only (scenarios, graph, journal/validate); `SandboxAttempt` is never read or written |
| Simulator engine (companies, journal entries, period close, statements, balance sheet, cash flow, content hashes) | `IMPLEMENTED` | `services/api/src/v1/simulator/{simulator.service,simulator-engine.service}.ts` (`hashEntries`, `hashLedgers`, `computeBalanceSheet`, `computeCashFlow`), 7 `Roles` routes | `simulator-property.spec.ts` and 2 further specs pass; web calls exist (`/api/v1/simulator/*`) |
| LLM decides accounting truth | none found | the LLM prompts instruct the model to follow the ontology (`content_pipeline.py:345-347`); no output is validated against a validator | acceptable as a rule only if validators sit after the LLM; today none do |
| Python validators (`validators/orchestrator.py`, account, journal, period, amount, direction, rule) | `UNWIRED` | `services/ai-api/v1/domain/validators/` | callers: tutor tools and tests only |

### Ontology

| Property | api golden graph | Python taxonomy |
|---|---|---|
| Size | 65 topics in 4 levels, 64 prerequisite edges | 13 ids (concepts, rules and misconceptions together) |
| Fields | `id`, `title`, `description`, `prerequisites`, `estimatedMinutes` | concept, rule, procedure, misconception objects with relations |
| Rules / validators / misconceptions per concept | none | yes |
| Assessment types, ground truth per concept | none (scenarios live in the sandbox provider) | benchmark rubrics (evaluation package) |
| Id scheme | `l1-t02-debits-credits` | `contra_account`, `double_entry` |
| Shared ids | **0** | |
| Used by | sandbox graph route, policy next-topic, Qdrant ingestion | prompt text (`render_domain_context`, at most 12 concepts) and unreachable packages |

No mapping between the two id spaces exists, and no component is designated the owner of the ontology. The api graph has 64 prerequisite edges over 65 nodes (the DAG shape, such as chain versus tree, was not analyzed).

### Open decision that bears on the domain design

`docs/strategy/decision-register.md:23` lists **D-01 Launch segment** (A university-first, B SMA-first, C both) as `PROPOSED, owner-confirm first`, and line 51 records the conflict with the 2026-09-30 note that treats accounting as only the first domain of a generic platform. The strategy set (`docs/strategy/06-accounting-domain.md`, `10-target-architecture.md`) assumes A. This audit does not resolve it; it affects copy, onboarding and minors handling, not the adapter boundary.

## Evidence citations

- `services/api/src/v1/sandbox/{accounting-sandbox.service,sandbox.controller,golden-scenarios.provider}.ts`; `services/api/src/v1/simulator/*.ts`
- `services/api/prisma/seed-data/golden-accounting-graph.json` (counted with a script: 4 levels, 65 topics, 64 prerequisite edges)
- `services/ai-api/v1/domain/` (22 production modules, 2,070 lines); `services/ai-api/v1/domain/data/default_taxonomy.py`; `services/ai-api/v1/domain/context.py:14-26`
- `services/ai-api/v1/tutor/personalization_prompt.py:12,30`; `services/ai-api/v1/learning/content_pipeline.py:345-347`
- `docs/strategy/decision-register.md:23,51`
- Tests: api `sandbox` (5 specs), `simulator` (3); ai-api `v1/domain/__tests__` (24)

## Verdict

Accounting truth is deterministic and lives where it should, in the api: journal validation and the simulator are tested and reachable from the web. There is no domain abstraction: no adapter interface, registry or domain id exists, the two accounting ontologies do not overlap, and accounting wording is written into tutor and pipeline prompts. The Python domain package is richer than the api graph (rules, misconceptions, validators) and is not connected to anything a learner reaches.
