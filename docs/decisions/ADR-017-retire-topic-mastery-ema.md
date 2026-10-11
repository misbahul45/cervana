# ADR-017: Retire the topic mastery EMA and read topic level views from concept mastery

- Status: built on 2026-10-10 at the owner's request to continue; the topic aggregate rule and the 0.85 eligibility threshold are proposals that wait for the owner (decision D-23)
- Date: 2026-10-10

## Context

ADR-014 made `ConceptMastery`, projected from the event stream, the mastery of record, and left the topic level EMA in place so that the web pages kept working. Two numbers now exist for the same quiz. The legacy record also feeds an access decision (creator eligibility), marketplace recommendations and admin analytics, and a backfill job writes it from step progress with no assessment evidence.

## Decision

1. Quiz submission stops writing the EMA; `updatedMastery` leaves the response.
2. The step progress backfill is removed.
3. Topic level views are computed on read from `ConceptMastery` through the approved curriculum links: topic score is the mean of the topic's concept scores with an unseen concept at zero.
4. Creator eligibility requires every concept of the topic to be passed and a mean of at least 0.85 (D-23, proposal).
5. Skill node states are derived on read; `personalization/{mastery,policy,skill-nodes}` routes and modules are deleted; the web reads `learner-model/me/mastery`.
6. `TopicMasteryRecord` and `SkillNode` stay in the schema, unread and unwritten, and a gate in `scripts/check-ownership-rules.sh` keeps code from using them.

## Consequences

- One mastery number per concept; every topic level figure is explainable from it.
- Topic level quizzes (no concept link) no longer produce any mastery; none exist today and a topic level quiz needs links first.
- Eligibility becomes stricter than a single high EMA score; nobody has applied yet.
- A route that the web or a client used (`personalization/mastery/me`, `policy/next`, `skill-nodes/me`) answers 404.
- Design: `docs/architecture/legacy-mastery-fold.md`; tasks: `docs/plans/legacy-mastery-fold-plan.md`.
