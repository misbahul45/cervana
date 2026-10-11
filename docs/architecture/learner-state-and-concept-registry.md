# Learner State and Concept Registry

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-09`
>
> How `api` owns one concept registry and one event-sourced mastery model, so that quiz evidence, the next-concept policy, the tutor prompt and the retrieval metadata all speak about the same concept ids.

Decision source: owner decisions Q-02 and Q-04 of [implementation-readiness.md](../01-audit/implementation-readiness.md), recorded in [ADR-009](../decisions/ADR-009-domain-ontology-owner.md) and [ADR-010](../decisions/ADR-010-one-mastery-model-and-policy.md); audit rows 2 to 5 and findings M-004, H-004, H-006 of [personalization-audit.md](../01-audit/personalization-audit.md) and [domain-audit.md](../01-audit/domain-audit.md). Decision record of this design: [ADR-014](../decisions/ADR-014-concept-registry-and-event-sourced-mastery.md). Tasks: [learner-state-and-concept-registry-plan.md](../plans/learner-state-and-concept-registry-plan.md).

---

## Purpose

Defines the registry of concepts, the append-only learning event, the pure mastery function `mastery-v1`, the projection and replay rules, the attribution of quiz evidence to concepts, the single policy with typed reason codes, and the read contract that `ai-api` uses to put learner state into the tutor prompt.

Out of scope, each with its owner decision:

| Not covered | Why | Tracked as |
|---|---|---|
| The final mastery formula | D-08 stays open; this design fixes where the formula lives and makes it replaceable by version, it does not settle which formula is right | `docs/strategy/decision-register.md` D-08 |
| Misconception events and the fold of the two misconception services | needs the misconception ontology (rules and patterns of the Python domain) moved to `api` first | plan task IMPL-LS-12, audit row 5 |
| Teaching strategy in the prompt | `api` does not know the intent of a chat turn; the strategy is returned by `LearnerPolicyService` to the tutor service only | follow-up of IMPL-LS-10 |
| Reward ledger from learning evidence | the next design; it reads the events defined here | audit row 9, H-008 remainder |
| Per-question concept tags | needs an authoring workflow; evidence is attributed per quiz until then | plan, "Risks" |
| Decay and forgetting | the fold is a pure function of events; recency is read time data (`lastEventAt`), the spacing policy is a later decision | D-08 |
| Web pages | replaced by the concept routes in [legacy-mastery-fold.md](./legacy-mastery-fold.md) (IMPL-LS-11); the misconception routes remain | IMPL-LS-12 |

## Research

Sources read on 2026-10-09. The page fetch tool summarizes long pages, so check wording before quoting it elsewhere. Where a source was not read in full, the right-hand column says so.

| Source | What it says | Consequence for this design |
|---|---|---|
| Pelánek, [Applications of the Elo rating system in adaptive educational systems](https://www.fi.muni.cz/~xpelanek/publications/CAE-elo.pdf), Computers & Education 2016 (accepted manuscript, text extracted locally and read in the relevant sections) | A student's answer is a match between student and item. A constant K trades slow convergence (small K) against instability (large K); earlier work used K = 0.4. An uncertainty function `U(n) = a / (1 + b n)` replaces K, with `a = 1`, `b = 0.05` as the reported starting values, fitted later by grid search; "principled approaches to modeling uncertainty actually do not bring significant advantages" over this pragmatic form (citing Nižnan et al. 2015). Items and students can use different functions because items collect many more answers. It names extensions for hints and response time but gives no single rule | `mastery-v1` is Elo in logit space with `U(n) = 1 / (1 + 0.05 n)`; `a` and `b` are named constants of the model version, so a grid search over real data produces `mastery-v2` and a replay, not a migration. Response time is not used (no timing is captured). Hints damp gains only |
| Corbett and Anderson, "Knowledge tracing" (1995), through secondary sources only ([Wikipedia](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) and course slides found by search; the paper itself was not opened) | Four parameters per skill (prior, learn, guess, slip); guess below 0.3 and slip below 0.1 were proposed to avoid degenerate fits; parameters were fitted to student data | BKT needs per-concept parameters fitted from response data, and the platform has none (the event table is empty). Elo needs two global meta-parameters with published defaults. BKT stays a candidate for `mastery-v2` once events exist; the versioned fold makes the swap a replay |
| Fowler, [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) | State is derivable from the ordered log, so it can be cached anywhere (snapshots); a bug fix is applied by correcting the code and reprocessing the events; bi-temporal reprocessing under old rules "can get very messy"; outgoing side effects must be suppressed during replay; retrofitting is hard so decide early | Projection rows are a cache of the fold and can be dropped and rebuilt. The fold is pure, so it has no side effect to suppress. A formula change replays under the new version; the rules of an old version are not kept alive next to it (no bi-temporal logic) |
| Microsoft Learn, [Event Sourcing pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) (page dated 2026-03-27) | Prefer events that carry intent over events that carry resulting state; never update stored events, correct with compensating events; evolve schemas with a version field, tolerant readers and upcasting; consumers must be idempotent; per-entity streams with optimistic concurrency and an incrementing sequence; snapshots are an optimization, not a replacement; apply the pattern selectively, "traditional data management is sufficient" for most parts; personal data in an immutable log conflicts with erasure | Events say what happened (`ASSESSMENT_COMPLETED` with score and items), never "mastery is now 0.7". One stream per learner with a gapless sequence guarded by a row lock. Unknown event types and unknown payload keys are ignored by the fold. Only mastery uses this pattern; the curriculum, orders and profiles stay relational. Erasure is the cascade delete of the learner, and events hold ids and numbers only |
| [xAPI statement structure](https://learningpool.com/xapi-statement-101-beyond-the-basic-elements/) and [Open edX OEP-26](https://open-edx-proposals.readthedocs.io/en/latest/architectural-decisions/oep-0026/xapi-realtime-events.html) (found by search, not read in full); 1EdTech [Caliper](https://www.1edtech.org/standards/caliper) | xAPI statements are actor, verb, object, result, context with a UUID `id` and an LRS-assigned stored time; Caliper groups events in typed metric profiles with a Sensor API. A search for idempotency rules of either standard returned nothing, so none is claimed | The event envelope keeps the shape (learner, type, object ids, result numbers, occurred and stored time, stable event id) so an export to xAPI or Caliper is a mapping, but neither standard is adopted: both would add a store and a vocabulary for a single producer |
| This repository, see "Current state" | the three vocabularies and four mastery implementations below | the registry and the single fold replace them |

## Current state

Measured on `HEAD cb0572f` plus the working tree of 2026-10-09; counts come from the running dev database.

| # | Fact | Evidence | Consequence |
|---|---|---|---|
| 1 | Three concept vocabularies with no shared id: 65 golden ids (`l1-t01-accounting-equation`), 10 `SubTopic` rows with 20 `Lesson` rows of the golden seed (Indonesian titles), 10 Python ids (`accounting_equation`, ...). ADR-009 says 13 Python concepts; `default_taxonomy.py` builds 10 and no other id occurs in `ai-api` code | `seed-data/golden-accounting-graph.json`, `seed-golden-graph.ts`, `v1/domain/data/default_taxonomy.py` | no id can be used across the services |
| 2 | Mastery is keyed by `Topic` (43 rows), not by concept, and it is written only when the quiz has a `topicId`; lesson, sub-topic and step quizzes never produce mastery | `quiz-attempts.service.ts` (`quiz.topicId` guard), `TopicMasteryRecord` | the learner state does not move for the quizzes the learner takes |
| 3 | Four mastery computations: EMA (`alpha 0.3`, live), an Elo-like TypeScript `MasteryService` injected in `TutorService` and the marketplace but never called, an Elo-like Python service (impure, sign-only golden vectors), and `SkillNodeService` side effects | `personalization/mastery/mastery.service.ts`, `learner-model/services/mastery.service.ts`, `ai-api/v1/learner_model/mastery.py` | no score can be recomputed or explained |
| 4 | Three policies: next-concept navigation (`personalization/policy`), tutoring strategy (`v1/policy`, free text rationale) and a Python strategy policy (13 strategies, typed reason codes, not wired) | the three files | one decision, three answers |
| 5 | Two id mismatches that make the policies inert: the navigation policy compares golden ids with `TopicMasteryRecord.topicId` (a `Topic` uuid), so its answer is always the first topic; `TutorService` reads mastery with `topicId ?? conceptKey`, which only matches when a topic uuid is passed, otherwise it falls back to the default 0.4 | `adaptive-policy.service.ts:44-87`, `tutor.service.ts:69-76` | the policies read nothing |
| 6 | `LearningEvent` exists with `userId`, `eventType`, `payload`, `idempotencyKey` unique per user, 0 rows, no writer in `src`; quiz submission writes the generic `EventLog` | `schema.prisma`, `db-invariants.int.spec.ts:395`, dev database | the event table is free to specialize; `EventLog` is not an event store |
| 7 | The tutor prompt of `ai-api` carries `dominantStyle` only; the learner-state renderer exists for Python types that no caller builds | `content_pipeline.py:134,314`, `tutor/personalization_prompt.py` | H-004 stays open until the api state reaches the prompt |
| 8 | The dev database has migration history (18 rows) and `LearningEvent`, `TopicMasteryRecord` are empty | `_prisma_migrations`, counts of 2026-10-09 | no data to migrate; the legacy `TopicMasteryRecord` stays readable |

## Conceptual model

```
Concept (registry, api)  <-- ConceptAlias (python ids, review status)
   |  \-- ConceptPrerequisite (DAG)
   |  \-- ConceptCurriculumLink --> Lesson | SubTopic (review status)
   v
LearningEvent (append only, stream per learner, seq 1..n)
   | fold: mastery-v1 (pure)
   v
ConceptMastery (cache of the fold)  <-- LearnerStream (lastSeq, modelVersion, row lock)
   v
LearnerPolicy: nextConcept(state, DAG) + teachingStrategy(state, intent) -> reason codes
   v
GET /learner-model/me/*   (learner)      GET /internal/learner-state, /internal/concepts (ai-api)
```

Invariants:

1. **One id.** A concept is identified by a stable text key, the golden graph id. It is never reused; a retired concept is `DEPRECATED`, its events stay valid.
2. **api is the only writer.** Registry, events and projections are written in `api`; `ai-api` reads them through signed internal routes (ADR-007, ADR-013). `ai-api` keeps no id table of its own: it resolves Python ids through the aliases it fetches.
3. **Events are facts, mastery is a view.** Events are never updated. A correction is a new event; erasure is the cascade delete of the learner.
4. **The projection is rebuildable.** `rebuild(userId)` folds the stream and must equal the stored rows; a test and a CLI check it. Changing the formula means a new `modelVersion` and a rebuild of every stream.
5. **Same transaction.** An append, the projection update and the head update commit together, so reads never lag behind the log and no consumer can skip an event.
6. **Only reviewed mappings act.** Aliases and curriculum links carry `PROPOSED` or `APPROVED`; evidence and resolution use `APPROVED` rows only. Concepts without a counterpart are listed as `UNMATCHED`, never guessed.

## Schema

New models and the extension of `LearningEvent` (Prisma; the SQL tail is written by hand because Prisma does not model it):

```prisma
enum ConceptStatus { ACTIVE DEPRECATED }
enum ReviewStatus  { PROPOSED APPROVED REJECTED }
enum AliasKind     { EXACT PART_OF UMBRELLA UNMATCHED }

model Concept {
  id               String        @id
  domain           String        @default("ACCOUNTING")
  title            String
  description      String?
  level            Int
  sortOrder        Int
  estimatedMinutes Int?
  status           ConceptStatus @default(ACTIVE)
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  prerequisites ConceptPrerequisite[] @relation("ConceptRequires")
  requiredBy    ConceptPrerequisite[] @relation("ConceptRequiredBy")
  aliases       ConceptAlias[]
  links         ConceptCurriculumLink[]
  masteries     ConceptMastery[]
  events        LearningEvent[]

  @@index([domain, level, sortOrder])
}

model ConceptPrerequisite {
  conceptId String
  requiresId String
  concept  Concept @relation("ConceptRequires", fields: [conceptId], references: [id], onDelete: Cascade)
  requires Concept @relation("ConceptRequiredBy", fields: [requiresId], references: [id], onDelete: Cascade)

  @@id([conceptId, requiresId])
  @@index([requiresId])
}

model ConceptAlias {
  id         String       @id
  scheme     String
  alias      String
  conceptId  String?
  kind       AliasKind
  status     ReviewStatus @default(PROPOSED)
  note       String?
  reviewedAt DateTime?
  concept    Concept?     @relation(fields: [conceptId], references: [id], onDelete: Cascade)

  @@index([scheme, alias])
  @@index([conceptId])
}

model ConceptCurriculumLink {
  id         String       @id
  conceptId  String
  subTopicId String?
  lessonId   String?
  status     ReviewStatus @default(PROPOSED)
  concept    Concept      @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  subTopic   SubTopic?    @relation(fields: [subTopicId], references: [id], onDelete: Cascade)
  lesson     Lesson?      @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@index([subTopicId])
  @@index([lessonId])
  @@index([conceptId])
}

model LearnerStream {
  userId       String   @id
  lastSeq      Int      @default(0)
  modelVersion String
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ConceptMastery {
  id            String   @id @default(uuid())
  userId        String
  conceptId     String
  theta         Float
  score         Float
  confidence    Float
  evidenceCount Int
  lastEventAt   DateTime
  lastSeq       Int
  modelVersion  String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  concept       Concept  @relation(fields: [conceptId], references: [id])

  @@unique([userId, conceptId])
  @@index([userId])
}

model LearningEvent {
  // existing columns stay
  conceptId     String?
  streamSeq     Int?
  schemaVersion Int      @default(1)
  concept       Concept? @relation(fields: [conceptId], references: [id])

  @@unique([userId, streamSeq])
  @@index([userId, conceptId, streamSeq])
}
```

Hand-written migration tail, in the style of `*_domain_foundation`:

- `CHECK` on `ConceptCurriculumLink` that exactly one of `subTopicId` and `lessonId` is set.
- `CHECK` on `ConceptAlias` that `conceptId` is null exactly when `kind = 'UNMATCHED'`.
- `CHECK` on `LearningEvent` that `streamSeq` is null or positive, and that a row with a `streamSeq` has a `conceptId` when `eventType = 'ASSESSMENT_COMPLETED'`.
- Trigger that rejects `UPDATE` of `LearningEvent` rows with a `streamSeq` (events are immutable). `DELETE` stays allowed for the cascade of an erased learner.
- Check that `ConceptMastery.score` and `confidence` are between 0 and 1.

Seed data, reviewed in git (the review of Q-02 is the review of these files):

| File | Content |
|---|---|
| `prisma/seed-data/golden-accounting-graph.json` | unchanged source of the 65 concepts, levels and prerequisites |
| `prisma/seed-data/concept-aliases.json` | the 10 Python ids with kind, target and status |
| `prisma/seed-data/concept-curriculum-links.json` | the sub-topic and lesson links with status |

`seed-concepts.ts` upserts by deterministic id (`concept key`, `scheme:alias:target`, `concept:subtopic title`), so it is idempotent, fails when a link points to a title that does not exist, and rejects a prerequisite cycle.

### Mapping of the Python ids (proposal, to be reviewed in the data file)

| Python id | Concept | Kind | Status | Reason |
|---|---|---|---|---|
| `accounting_equation` | `l1-t01-accounting-equation` | EXACT | APPROVED | same name and meaning |
| `double_entry` | `l1-t13-double-entry-logic` | EXACT | APPROVED | same name and meaning |
| `journal_entry` | `l1-t03-journal-entries` | EXACT | APPROVED | same name and meaning |
| `adjusting_entry` | `l1-t06-adjusting-entries` | EXACT | APPROVED | same name and meaning |
| `accrual_vs_cash` | `l1-t11-cash-vs-accrual` | EXACT | APPROVED | same name and meaning |
| `trial_balance` | `l1-t05-trial-balance` | EXACT | APPROVED | same name and meaning |
| `revenue_recognition` | `l2-t13-revenue-recognition` | EXACT | APPROVED | same name and meaning |
| `normal_balance` | `l1-t02-debits-credits` | PART_OF | PROPOSED | the normal balance of an account is taught inside debits and credits; there is no concept of its own |
| `financial_statements` | `l2-t01`, `l2-t02`, `l2-t03`, `l2-t04` | UMBRELLA | PROPOSED | one Python concept spans four golden concepts; a resolver must return the set |
| `contra_account` | none | UNMATCHED | PROPOSED | no golden concept covers contra accounts; the closest topics (`l1-t10-chart-of-accounts`, `l2-t10-receivables-bad-debt`) only contain examples of it. The owner decides whether to add a concept |

The seven `EXACT` rows are marked approved by the author of this design because name and meaning are identical; the owner confirms by merging the data file. The three others do not act until their status is changed in the file.

### Links of the golden seed to concepts (as seeded)

Sub-topic links:

| Sub-topic of the seed | Concepts | Status |
|---|---|---|
| Persamaan Dasar Akuntansi | `l1-t01-accounting-equation` | APPROVED |
| Debit dan Kredit | `l1-t02-debits-credits` | APPROVED |
| Double Entry | `l1-t13-double-entry-logic` | APPROVED |
| Jurnal Entries | `l1-t03-journal-entries` | APPROVED |
| Buku Besar | `l1-t04-ledger-accounts` | APPROVED |
| Neraca Saldo | `l1-t05-trial-balance` | APPROVED |
| Jurnal Penyesuaian | `l1-t06-adjusting-entries` | APPROVED |
| Laporan Keuangan | `l2-t01-balance-sheet`, `l2-t02-income-statement`, `l2-t03-cash-flow-statement` | APPROVED (the fourth statement, changes in equity, has no lesson and is not linked) |
| Akuntansi Fundamentals | `l1-t09-accounting-cycle` | PROPOSED (the lesson "Apa itu akuntansi" has no concept) |
| Jenis Akun | `l1-t10-chart-of-accounts` | PROPOSED (real and nominal accounts are not the chart of accounts) |

Lesson links, which win over the sub-topic link when approved: "Laporan posisi keuangan", "Laporan laba rugi" and "Laporan arus kas" map one to one to the three statements (APPROVED, titles match); "Penyusutan aset tetap" to `l2-t11-pppe-depreciation` is PROPOSED. Every other lesson has no link of its own and falls back to its sub-topic.

## Algorithms

### Append an event

1. Start a transaction (or join the caller's).
2. `INSERT INTO "LearnerStream" ... ON CONFLICT DO NOTHING`, then `SELECT ... FOR UPDATE` on the learner's row. This serializes writers of one learner and is the optimistic-concurrency point of the stream.
3. If an event with the same `(userId, idempotencyKey)` exists, return it unchanged (idempotent append).
4. `seq = lastSeq + 1`; insert the event with `streamSeq = seq`; fold it into the learner's `ConceptMastery` row for the event's concept; set `lastSeq`.
5. Commit. A failure anywhere rolls back all three writes.

The idempotency key of an assessment is `assessment:{attemptId}:{conceptId}`, so a retried submission appends nothing.

### Event `ASSESSMENT_COMPLETED` (schema version 1)

`conceptId` is a column. The payload is validated with a strict zod schema on write and read tolerantly by the fold:

| Field | Meaning |
|---|---|
| `attemptId`, `quizId` | where the evidence comes from |
| `score` | 0 to 1, points earned over points possible |
| `items` | number of questions in the attempt |
| `hintsUsed` | 0 or more; today the boolean `hintUsed` of the submission maps to 0 or 1 |
| `share` | 0 to 1, the part of the attempt credited to this concept (1 divided by the number of concepts the quiz is linked to) |
| `attemptNumber` | 1 for the first attempt of this learner on this quiz |
| `difficulty` | optional item difficulty in logit units, default 0, clamped to -3 and 3 |

### `mastery-v1` (pure function)

State per concept: `theta` (logit skill, start 0), `n` (events folded), derived `score`, `confidence`.

```
sigmoid(x)     = 1 / (1 + e^-x)
U(n)           = 1 / (1 + 0.05 n)
P              = sigmoid(theta - difficulty)
w              = share * min(items, 5) / 5 * 0.5^(attemptNumber - 1)
delta          = U(n) * w * (score - P)
if delta > 0:  delta = delta * 0.6^min(hintsUsed, 3)
theta'         = clamp(theta + delta, -6, 6)
n'             = n + 1
score'         = sigmoid(theta')
confidence'    = 0.05 n' / (1 + 0.05 n')        (equals 1 - U(n'))
```

Choices and why:

- Logit space keeps `score` in (0, 1) without clamping tricks and makes the expected value `P` a probability, so `score - P` is the surprise of the attempt (Pelánek).
- `w` bounds what one event can say: a one-question quiz counts one fifth of a five-question quiz; a quiz shared by four concepts credits each a quarter; each retake of the same quiz halves the weight again, so repeating a quiz to inflate the score converges to a small total (the sum of `0.5^k` is 2, against unbounded for equal weights). This is the learning-evidence half of the farming fix (H-008).
- Hints damp gains and never reduce a penalty, so hints cannot be used to lower the cost of a wrong answer.
- `score` converges to the learner's success rate on items of difficulty `difficulty`: three attempts at 70 percent give 0.55, 0.585, 0.61 and approach 0.70.
- `confidence` is the share of the initial uncertainty already spent, so the learning rate and the reported confidence are the same quantity. Decisions of the policy use the evidence count, not the confidence.

Reference values (checked in the tests, computed with the formula above):

| Sequence from a fresh learner (5 items, share 1, no hints) | Score after each event |
|---|---|
| five attempts at 100 percent | 0.622, 0.703, 0.756, 0.793, 0.820 |
| three attempts at 70 percent | 0.550, 0.585, 0.610 |
| four attempts at 100 percent, each on the same quiz (`attemptNumber` 1 to 4) | 0.622, 0.664, 0.681, 0.688 |
| eight attempts at 100 percent, then one at 0 percent | 0.869, then 0.780 |
| first attempt at 100 percent with 0, 1, 2, 3 hints: gain of `theta` | 0.500, 0.300, 0.180, 0.108 |
| five attempts at 100 percent, share 0.25 | 0.625 |

### Replay and versions

`replay(events, version)` folds a stream in `streamSeq` order from the empty state. `rebuildLearner(userId)` replaces the learner's `ConceptMastery` rows with the replay inside the learner's lock and returns the rows that changed, so a run on an unchanged formula returns nothing (checked by the integration test). Unknown event types and unknown payload keys are skipped without error (tolerant reader). A new formula is a new constant `MASTERY_MODEL_VERSION` with its fold; the rebuild job runs for every `LearnerStream` whose `modelVersion` differs.

### Attribution of quiz evidence

On submission, inside the grading transaction: resolve the quiz to concepts, most specific first: lesson links of the quiz's lesson (or of the step's lesson), else sub-topic links of its sub-topic (or of the lesson's sub-topic); topic level quizzes have no concept. Only `APPROVED` links count. With `k` links, each event carries `share = 1 / k`. The legacy `TopicMasteryRecord` update was retired by IMPL-LS-11 ([legacy-mastery-fold.md](./legacy-mastery-fold.md)); topic level quizzes without links produce no mastery.

### Policy

One module with two decisions over the same state, both returning typed reason codes (no free text).

`nextConcept(learner)`: reads `ConceptMastery` and the prerequisite DAG. A concept is `PASSED` at `score >= 0.7` with at least 3 events; it is `READY` when all its direct prerequisites are passed; the answer is the first `READY` and not `PASSED` concept in `(level, sortOrder)` order, so a passed concept whose score falls back is offered again before the learner moves on. Reason codes: `NO_CONCEPTS`, `NO_EVIDENCE_START` (nothing recorded anywhere, start at the first concept), `PREREQUISITES_MET` (a concept without evidence whose prerequisites are passed), `CONTINUE_PRACTICE` (a concept with evidence below the pass mark), `UNREACHABLE_PREREQUISITES` (no concept can start, which only a cyclic graph produces, fallback to the first unfinished one), `ALL_CONCEPTS_PASSED`. The golden graph ids now match the mastery keys, which removes the permanent "first topic" answer. The earlier idea of a separate `REVIEW_WEAK_PREREQUISITE` code was dropped: a weak prerequisite is not passed, so the order rule already returns it.

`teachingStrategy(input)`: the rule set of the former `v1/policy/adaptive-policy.service.ts` (strategy by intent, mastery band, misconception count, prerequisite state), with `rationale` replaced by `reasonCodes`: `OPEN_MISCONCEPTIONS`, `PREREQUISITE_NOT_MET`, `LOW_MASTERY`, `MID_MASTERY`, `HIGH_MASTERY`, `INTENT_CHALLENGE`, `INTENT_TRANSFER`, `INTENT_PRACTICE`, `REVIEW_DUE`, `PERSONAL_STRATEGY_PREFERRED`, and `INSUFFICIENT_EVIDENCE` (appended when fewer than 3 events back the mastery; the attempt cap then defaults to 4). `confidence` no longer influences a decision: a personal strategy preference needs 3 events instead of the former `confidence > 0.7`. The Python `AdaptivePolicyService` remains reference material (ADR-010).

### Read contract for ai-api

| Route | Caller | Returns |
|---|---|---|
| `GET /learner-model/me/mastery` | learner | concepts with score, confidence, evidence count, last event time |
| `GET /learner-model/me/next` | learner | the `nextConcept` decision with the concept title |
| `GET /internal/learner-state?lessonId=...&userStepId=...&conceptId=...` | `ai-api`, acting user = learner | `{ userId, concepts: [state of each named, lesson-linked or user-step-linked concept with its prerequisites], next }`; the lesson, or the user step of the acting user (user step, template step, lesson), is resolved to approved concepts inside `api`; rows only of the acting user, a `userId` query is ignored, and a user step of another learner resolves to nothing |
| `GET /internal/concepts` | `ai-api` | active concepts, prerequisites and approved `PYTHON_DOMAIN` aliases |

`ai-api` gets a `ConceptCatalog` adapter (`v1/domain/adapter.py`) that fetches `/internal/concepts` through `InternalApiClient`, caches it for 5 minutes, and offers `resolve(any_id) -> list[concept id]` (golden ids pass through, Python ids go through approved aliases, unmatched ids return nothing). The lesson-material prompt (`generate_material`) and the chat continuation prompt (`get_propmpt_material`, resolved through the user step) get the block inside its `<learner_state trust="derived">` segment next to the learning style: per concept the id, a sanitized title, the matching Python ids (reverse of the approved aliases), score, confidence, evidence count and prerequisite status, then the next concept with its reason codes, and a one-line scale note (score 0.50 with evidence 0 means no evidence). If the read, the registry or the rendering fails the block is omitted and the failure is logged, because a missing hint must not stop a lesson; a registry that is down only costs the Python ids.

## Trade-offs

| Option | Verdict |
|---|---|
| A. Keep Topic keyed EMA and add concepts later | rejected: the policies and the prompt need concept ids; keeping the EMA as the source keeps four implementations |
| B. Event store as a new table `LearnerEvent` | rejected: `LearningEvent` is empty, has no writer, already carries the idempotency key and the indexes, and a second event table repeats the duplication this design removes |
| C. Whole domain event-sourced | rejected: Microsoft and Fowler both advise selective use; only mastery needs replay and audit |
| D. Asynchronous projection through a queue | rejected for now: it adds eventual consistency and a consumer that can lag or skip; the write volume (one event per quiz and concept) is small enough to project in the same transaction |
| E. Elo in logit space with an uncertainty function (chosen as `mastery-v1`) | chosen: two published constants, no training data needed, explainable, replaceable by version |
| F. BKT | deferred: needs fitted guess, slip, learn and prior per concept; revisit with data |
| G. IRT with calibrated items | deferred: needs item calibration, which the Elo form approximates online |
| H. Per-question concept tags now | deferred: better evidence, needs an authoring tool and re-tagging of 5 quizzes per concept; quiz level attribution with shares and retake decay is the safe approximation |
| I. Copy the 65 ids into `ai-api` | rejected by ADR-009 (one owner) |
| J. Admin approval endpoint for aliases and links | not chosen: review in git of three data files needs no new route, no access decision and leaves a history; revisit when non-developers curate the ontology |
| K. Delete the legacy `personalization/*` routes now | not chosen: the web uses them; they are folded in IMPL-LS-11 with a browser check |

Residual risks: the formula is a proposal until D-08 is decided (mitigated by versioned replay); quiz level attribution blurs evidence when a quiz covers several concepts (mitigated by `share`); mappings marked `PROPOSED` mean the sub-topics Akuntansi Fundamentals and Jenis Akun, the lesson Penyusutan aset tetap and the three Python ids `normal_balance`, `financial_statements` and `contra_account` do not yet produce or resolve evidence.

## Migration notes

- **Database**: one migration, written by hand from `prisma migrate diff`, with the SQL tail above; tested on a scratch database first (`TEST_DATABASE_URL`), then `migrate deploy` on the dev database, which has history and no event data.
- **Seed**: `pnpm seed:concepts` after `pnpm seed:golden-graph`; idempotent.
- **Order**: schema and seed, then the fold and event writer, then quiz wiring, then policy and routes, then the internal routes, then `ai-api`. Each step ships on its own because nothing reads the next step's output until it exists.
- **Existing code**: `learner-model/services/mastery.service.ts` (never called) is deleted with its injections in `TutorModule` and the marketplace; `TutorService` reads `ConceptMastery`; the legacy EMA and its routes stay until IMPL-LS-11.
- **Rollback**: the new tables can stay unused; reverting the quiz hook stops events; the rebuild reproduces the projection from the log at any time.

## Verification

Run on 2026-10-09 against the scratch database `reducera_ls_scratch` and the live dev stack.

| Check | Result |
|---|---|
| `prisma migrate diff` after `migrate deploy`, scratch and dev | empty |
| `services/api` `pnpm jest --ci --silent` | 126 suites, 1350 tests passed |
| same with `TEST_DATABASE_URL` on the scratch database, `--runInBand` | 141 suites, 1535 tests passed (the five new `*.int.spec.ts` suites included) |
| `services/ai-api` `uv run pytest -q` | 647 passed (615 before) |
| `scripts/check-ownership-rules.sh` | PASS, with the new gate "learner tables written outside the learner events service" |
| Mutations that the tests killed | cycle detection off, status reset on reseed, stale alias kept, approved-only filters off, hint damping on penalties, retake decay off, theta limit off, stream lock removed (concurrency test), version rebuild skipped, quiz hook outside the transaction, hint guard removed, policy thresholds, TTL cache off, stale serve off, unknown id guessed, fail-open removed, lesson guard removed, internal route reading `userId` from the query |
| Live: test learner, lesson quiz, two submissions through `POST /quiz/quiz-attempts/start` and `/submit` | two events (`streamSeq` 1 and 2, `attemptNumber` 1 and 2), mastery 0.5710 after two perfect two-question attempts (hand computed: 0.5498 then 0.5710), a second submit of the first attempt answers 409 and adds nothing |
| Live: `GET /learner-model/me/mastery` and `/me/next` | empty and `NO_EVIDENCE_START` before, the concept and `PREREQUISITES_MET` after |
| Live, inside the worker container with the signed client and the configured Mistral gateway: `fetch_learner_state`, `ConceptCatalog.load`, `generate_material` | signed calls to `/internal/learner-state` and `/internal/concepts` accepted, the prompt carried the block (shown in the report), the model answered 200 with 3815 characters |
| Fixtures | test learner, quiz and events were deleted afterwards; the registry (65 concepts) stays |

Defect found while testing live and fixed here: `POST /quiz/quiz-attempts/start` answered 400 for every caller, because `@ScopeToUser()` writes `userId` into the body and the strict `StartQuizAttemptDto` rejects it. The route now carries `@AuthenticatedOnly()` (the service already used the caller id) and `quiz-attempts.controller.spec.ts` covers it.

Not verified: a real BullMQ job, behavior with a second concurrent learner on the dev stack, and the web pages (they still use the legacy `personalization/*` routes).

## Evidence citations

- `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts` (`submitAttempt`, `quiz.topicId` guard), `personalization/mastery/mastery.service.ts`, `learner-model/services/mastery.service.ts`, `v1/tutor/tutor.service.ts:69-76`
- `services/api/src/v1/personalization/policy/adaptive-policy.service.ts:44-87`, `v1/policy/adaptive-policy.service.ts`
- `services/api/prisma/schema.prisma` (`LearningEvent`, `TopicMasteryRecord`, `Misconception`, `Quiz`, `Question`, `QuizAttempt`, `SubTopic`, `Lesson`), `prisma/seed-golden-graph.ts`, `prisma/seed-data/golden-accounting-graph.json`
- `services/ai-api/v1/domain/data/default_taxonomy.py`, `v1/learner_model/{mastery,policy,state}.py`, `v1/learning/content_pipeline.py:134,314`, `v1/tutor/personalization_prompt.py`
- Dev database counts of 2026-10-09: `Topic` 43, `SubTopic` 10, `Lesson` 20, `LearningEvent` 0, `TopicMasteryRecord` 0, `_prisma_migrations` 18
- Reference values of the table "Reference values" were computed with a throwaway script of the author with the formula of this document; the tests of IMPL-LS-04 recompute them independently.
