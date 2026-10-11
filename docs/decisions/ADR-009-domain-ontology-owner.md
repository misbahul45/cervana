# ADR-009: Owner of the domain ontology

- Status: accepted by the owner on 2026-10-09 (Q-02 of `docs/01-audit/implementation-readiness.md`)
- Date: 2026-10-09

## Context

Two ontologies exist with no shared identifier: the `api` golden graph (65 topics, ids such as `l1-t01-accounting-equation`) and the Python domain in `services/ai-api/v1/domain/` (13 concepts with rules and misconceptions). No adapter layer connects them, and the tutor retrieval filter matches none of the stored chunks (`docs/01-audit/domain-audit.md`, `docs/01-audit/rag-audit.md`).

## Decision

1. `api` owns concept identifiers and prerequisite relations. It is the only writer of curriculum structure, consistent with ADR-001 (curriculum is platform-global) and with the ownership table in `AGENTS.md`.
2. The rules and misconception patterns that exist only in the Python domain move to `api` as data attached to those identifiers.
3. `ai-api` consumes the ontology through a domain adapter that reads it from `api` over the signed internal contract of ADR-007. It does not keep a second copy of ids.
4. A mapping from the 13 Python concept ids to api topic ids is produced once, reviewed, and stored in `api`; ids without a counterpart are listed, not guessed.

## Consequences

- Chunk metadata, learner state and gamification refer to api topic ids only.
- The Python `ConceptGraph` and validators remain as reference until the adapter replaces their callers; they are not wired as they stand.
- Blocks audit rows 2 to 5 until the Phase 3 domain-adapter design exists.
