# ADR-014: Concept registry and event-sourced mastery in api

- Status: accepted by the owner on 2026-10-09 (the owner asked to combine the designs of Q-02 and Q-04 and to implement them)
- Date: 2026-10-09

## Context

ADR-009 gave `api` the ownership of concept identifiers and ADR-010 gave it the one mastery model and the one policy, both without a design. Today three concept vocabularies share no id, mastery is keyed by `Topic` and is written only for topic level quizzes, four mastery computations and three policies coexist, two id mismatches make the policies read nothing, and `LearningEvent` has no writer (`docs/architecture/learner-state-and-concept-registry.md`, "Current state").

## Decision

1. `api` keeps a concept registry: `Concept` (stable text key, the golden graph id), `ConceptPrerequisite`, `ConceptAlias` (Python ids) and `ConceptCurriculumLink` (sub-topics and lessons). Aliases and links carry a review status; only `APPROVED` rows act. The three seed data files are reviewed in git.
2. `LearningEvent` becomes the append-only event store of the learner: one stream per learner with a gapless `streamSeq`, written under a row lock on `LearnerStream`, idempotent by `(userId, idempotencyKey)`, immutable after insert. Events state what happened; corrections are new events; erasure is the cascade delete of the learner.
3. Mastery is the pure fold `mastery-v1` (Elo in logit space, `U(n) = 1 / (1 + 0.05 n)`, evidence weight by items, share and retake, hints damp gains only). `ConceptMastery` is its cache and is projected in the same transaction as the append. A change of formula is a new model version and a rebuild by replay. The formula is a proposal for D-08 and does not close it.
4. Quiz submission appends `ASSESSMENT_COMPLETED` events for the approved concepts of the quiz, most specific link first, with `share = 1 / number of links`. The legacy `TopicMasteryRecord` update stays until the web routes are folded.
5. One policy module in `api` makes both decisions (next concept and teaching strategy) over `ConceptMastery` and the prerequisite DAG, and returns typed reason codes. The never-called Elo `MasteryService` of `learner-model/` and the duplicate strategy service are removed; the Python mastery and policy stay as reference.
6. `ai-api` reads the registry and the learner state through signed internal routes (`GET /internal/concepts`, `GET /internal/learner-state`), resolves Python ids through approved aliases in a `ConceptCatalog` adapter and keeps no id table. The lesson-material prompt and the chat continuation prompt get a derived learner-state block; a failed read omits the block.

## Consequences

- A score can be explained and recomputed from its events; a new formula is a replay, not a migration.
- Quizzes of lesson, sub-topic and step level now move the learner state; topic level quizzes keep updating only the legacy record.
- The next-concept and teaching decisions read real, concept keyed mastery for the first time.
- Evidence for the sub-topics Akuntansi Fundamentals and Jenis Akun, the lesson Penyusutan aset tetap, and the resolution of `normal_balance`, `financial_statements` and `contra_account` wait for the owner to approve the proposed mappings (`contra_account` has no counterpart concept at all).
- Mastery quality is bounded by quiz level attribution until questions are tagged with concepts.
- The legacy `personalization/*` mastery and navigation routes were retired by [ADR-017](./ADR-017-retire-topic-mastery-ema.md) (IMPL-LS-11); the misconception routes stay until IMPL-LS-12, so ADR-010 is open only for misconceptions.
- Design: `docs/architecture/learner-state-and-concept-registry.md`; tasks: `docs/plans/learner-state-and-concept-registry-plan.md`.
