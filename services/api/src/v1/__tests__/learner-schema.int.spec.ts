import { randomUUID } from 'crypto';
import { Pool, PoolClient } from 'pg';
import {
  createPool,
  describeDb,
  expectViolation,
  insertUser,
  withRollback,
} from '@/test-utils/pg-fixtures';

const insertConcept = async (client: PoolClient, id = `c-${randomUUID().slice(0, 8)}`) => {
  await client.query(
    `INSERT INTO "Concept" (id, title, level, "sortOrder", "updatedAt") VALUES ($1, 'Title', 1, 1, now())`,
    [id],
  );
  return id;
};

const insertEvent = (client: PoolClient, values: { userId: string; type?: string; conceptId?: string | null; seq?: number | null; key?: string | null }) =>
  client.query(
    `INSERT INTO "LearningEvent" (id, "userId", "eventType", payload, "conceptId", "streamSeq", "idempotencyKey")
     VALUES (gen_random_uuid(), $1, $2, '{}'::jsonb, $3, $4, $5)`,
    [values.userId, values.type ?? 'ASSESSMENT_COMPLETED', values.conceptId ?? null, values.seq ?? null, values.key ?? null],
  );

describeDb('learner state schema (requires TEST_DATABASE_URL)', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = createPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('concept registry', () => {
    it('a concept cannot require itself and a prerequisite pair is stored once', () =>
      withRollback(pool, async (c) => {
        const a = await insertConcept(c);
        const b = await insertConcept(c);
        const insert = `INSERT INTO "ConceptPrerequisite" ("conceptId", "requiresId") VALUES ($1, $2)`;
        expect((await expectViolation(c, insert, [a, a])).constraint).toBe('ConceptPrerequisite_not_self');
        await c.query(insert, [a, b]);
        expect((await expectViolation(c, insert, [a, b])).constraint).toBe('ConceptPrerequisite_pkey');
      }));

    it('a curriculum link targets exactly one of sub-topic and lesson', () =>
      withRollback(pool, async (c) => {
        const concept = await insertConcept(c);
        const error = await expectViolation(
          c,
          `INSERT INTO "ConceptCurriculumLink" (id, "conceptId") VALUES ($1, $2)`,
          [randomUUID(), concept],
        );
        expect(error.constraint).toBe('ConceptCurriculumLink_exactly_one_target');
        const both = await expectViolation(
          c,
          `INSERT INTO "ConceptCurriculumLink" (id, "conceptId", "subTopicId", "lessonId") VALUES ($1, $2, $3, $4)`,
          [randomUUID(), concept, randomUUID(), randomUUID()],
        );
        expect(both.code).toMatch(/23514|23503/);
      }));

    it('an alias has a target unless it is UNMATCHED', () =>
      withRollback(pool, async (c) => {
        const concept = await insertConcept(c);
        const insert = `INSERT INTO "ConceptAlias" (id, scheme, alias, "conceptId", kind) VALUES ($1, 'PYTHON_DOMAIN', 'x', $2, $3::"AliasKind")`;
        expect((await expectViolation(c, insert, [randomUUID(), concept, 'UNMATCHED'])).constraint).toBe('ConceptAlias_target_matches_kind');
        expect((await expectViolation(c, insert, [randomUUID(), null, 'EXACT'])).constraint).toBe('ConceptAlias_target_matches_kind');
        await c.query(insert, [randomUUID(), concept, 'EXACT']);
        await c.query(insert, [randomUUID(), null, 'UNMATCHED']);
      }));
  });

  describe('learner event stream', () => {
    it('an event names a registered concept', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const error = await expectViolation(
          c,
          `INSERT INTO "LearningEvent" (id, "userId", "eventType", payload, "conceptId", "streamSeq") VALUES (gen_random_uuid(), $1, 'ASSESSMENT_COMPLETED', '{}'::jsonb, 'no-such-concept', 1)`,
          [user],
        );
        expect(error.constraint).toBe('LearningEvent_conceptId_fkey');
      }));

    it('a stream sequence is positive and unique per learner', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const other = await insertUser(c);
        const concept = await insertConcept(c);
        const insert = `INSERT INTO "LearningEvent" (id, "userId", "eventType", payload, "conceptId", "streamSeq") VALUES (gen_random_uuid(), $1, 'ASSESSMENT_COMPLETED', '{}'::jsonb, $2, $3)`;
        expect((await expectViolation(c, insert, [user, concept, 0])).constraint).toBe('LearningEvent_streamSeq_positive');
        await c.query(insert, [user, concept, 1]);
        expect((await expectViolation(c, insert, [user, concept, 1])).constraint).toBe('LearningEvent_userId_streamSeq_key');
        await c.query(insert, [user, concept, 2]);
        await c.query(insert, [other, concept, 1]);
      }));

    it('an assessment event in the stream needs a concept', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const error = await expectViolation(
          c,
          `INSERT INTO "LearningEvent" (id, "userId", "eventType", payload, "streamSeq") VALUES (gen_random_uuid(), $1, 'ASSESSMENT_COMPLETED', '{}'::jsonb, 1)`,
          [user],
        );
        expect(error.constraint).toBe('LearningEvent_assessment_has_concept');
      }));

    it('a stored stream event cannot be updated, a legacy event without a sequence can', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const concept = await insertConcept(c);
        await insertEvent(c, { userId: user, conceptId: concept, seq: 1, key: 'stream' });
        await insertEvent(c, { userId: user, type: 'LESSON_COMPLETED', key: 'legacy' });

        const rejected = await expectViolation(c, `UPDATE "LearningEvent" SET payload = '{"x":1}'::jsonb WHERE "idempotencyKey" = 'stream'`);
        expect(rejected.message).toMatch(/immutable/i);
        await c.query(`UPDATE "LearningEvent" SET payload = '{"x":1}'::jsonb WHERE "idempotencyKey" = 'legacy'`);
      }));

    it('deleting the learner removes the stream, the events and the projection', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const concept = await insertConcept(c);
        await c.query(`INSERT INTO "LearnerStream" ("userId", "lastSeq", "modelVersion", "updatedAt") VALUES ($1, 1, 'mastery-v1', now())`, [user]);
        await insertEvent(c, { userId: user, conceptId: concept, seq: 1, key: 'k' });
        await c.query(
          `INSERT INTO "ConceptMastery" (id, "userId", "conceptId", theta, score, confidence, "evidenceCount", "lastEventAt", "lastSeq", "modelVersion")
           VALUES (gen_random_uuid(), $1, $2, 0.5, 0.62, 0.05, 1, now(), 1, 'mastery-v1')`,
          [user, concept],
        );

        await c.query(`DELETE FROM "User" WHERE id = $1`, [user]);

        for (const table of ['LearnerStream', 'LearningEvent', 'ConceptMastery']) {
          const { rows } = await c.query(`SELECT count(*)::int AS n FROM "${table}" WHERE "userId" = $1`, [user]);
          expect(rows[0].n).toBe(0);
        }
      }));
  });

  describe('concept mastery projection', () => {
    it('keeps score and confidence between 0 and 1 and one row per learner and concept', () =>
      withRollback(pool, async (c) => {
        const user = await insertUser(c);
        const concept = await insertConcept(c);
        const insert = `INSERT INTO "ConceptMastery" (id, "userId", "conceptId", theta, score, confidence, "evidenceCount", "lastEventAt", "lastSeq", "modelVersion")
                        VALUES (gen_random_uuid(), $1, $2, 0, $3, $4, 1, now(), 1, 'mastery-v1')`;
        expect((await expectViolation(c, insert, [user, concept, 1.2, 0.1])).constraint).toBe('ConceptMastery_bounds');
        expect((await expectViolation(c, insert, [user, concept, 0.5, -0.1])).constraint).toBe('ConceptMastery_bounds');
        await c.query(insert, [user, concept, 0.5, 0.1]);
        expect((await expectViolation(c, insert, [user, concept, 0.6, 0.2])).constraint).toBe('ConceptMastery_userId_conceptId_key');
      }));
  });
});
