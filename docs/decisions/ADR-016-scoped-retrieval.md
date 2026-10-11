# ADR-016: Governance metadata on every chunk and a scope on every retrieval

- Status: accepted by the owner on 2026-10-10 (the owner asked to continue the implementation after the reward ledger; row 4a of the readiness table)
- Date: 2026-10-10

## Context

The only filter used in production (`metadata.source == "material"`) matches none of the 65 stored chunks, so the tutor writes ungrounded text with an empty citation list (finding C-002). No chunk has tenant, status, access scope, version, domain or concept metadata, no caller filters by user or access, and two callers retrieve without any filter. Concept ids are now owned by `api` (ADR-009, ADR-014) and equal the `topic_id` of the stored chunks.

## Decision

1. Every chunk carries the governance metadata of contract v1: schema version, document kind, domain, status, access scope, owner, tenant, concept ids and a stable chunk id. `upsert_document` refuses a write without a validated `Governance` and does not let a caller override a governance key.
2. Every retrieval takes a `RetrievalScope` (actor, domain, optional concept ids, optional tenant ids). There is no unfiltered mode. The scope is turned into one native Qdrant filter on flat keys, in one tested function: `status == PUBLISHED`, the domain, and the access rule (platform, or owner equal to the actor, or tenant in the caller's list).
3. Concept scoping is a two-stage search: chunks of the lesson's concepts first, then the domain wide results to fill up to `top_k` when fewer than three came back. Concept ids come from the existing `GET /internal/learner-state` call.
4. The 65 stored chunks are backfilled with `set_payload` (no re-embedding), in both the payload and `_node_content`; payload indexes are created for the filtered fields.
5. Citations carry only what the chunk knows (chunk, concept, lesson, resource); nothing is filled from the current lesson, and `lesson_id` becomes optional.
6. Each retrieval logs actor, domain, count and chunk ids, not text.
7. A failure of the embedding gateway or of the store is raised as `RetrievalError` and the callers degrade to an answer without materials; writes are not degraded.
8. The learner summary that quiz generation stores is written as `OWNER` content of its author, so no other learner can retrieve it.

## Consequences

- The tutor is grounded on the stored chunks again, and a chunk another actor may not see cannot reach a prompt.
- Writers outside the repository that call `upsert_document` or `retrieve` with the old signature fail until updated; the five in-repo callers are updated here.
- `TENANT` and `OWNER` scopes are enforced and tested but nothing writes them yet.
- Retrieval quality is bounded by the thin outline chunks until real content is ingested.
- Design: `docs/architecture/scoped-retrieval.md`; tasks: `docs/plans/scoped-retrieval-plan.md`.
