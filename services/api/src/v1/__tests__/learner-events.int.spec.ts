import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { AssessmentPayload } from '@/v1/learner-model/mastery/assessment-payload';
import { MASTERY_MODEL_VERSION } from '@/v1/learner-model/mastery/mastery-v1';
import { LearnerEventsService } from '@/v1/learner-model/events/learner-events.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { createPool, databaseUrl, describeDb, insertUser } from '@/test-utils/pg-fixtures';

const payload = (overrides: Partial<AssessmentPayload> = {}): AssessmentPayload => ({
  attemptId: randomUUID(),
  quizId: 'quiz-1',
  score: 1,
  items: 5,
  hintsUsed: 0,
  share: 1,
  attemptNumber: 1,
  ...overrides,
});

describeDb('learner events (requires TEST_DATABASE_URL)', () => {
  let prisma: PrismaService;
  let pool: Pool;
  let events: LearnerEventsService;
  const concepts: string[] = [];
  const users: string[] = [];

  const newConcept = async (status: 'ACTIVE' | 'DEPRECATED' = 'ACTIVE') => {
    const id = `ev-${randomUUID().slice(0, 8)}`;
    await prisma.concept.create({ data: { id, title: id, level: 1, sortOrder: 1, status } });
    concepts.push(id);
    return id;
  };

  const newUser = async () => {
    const id = await insertUser(pool);
    users.push(id);
    return id;
  };

  const input = (userId: string, conceptId: string, overrides: Partial<AssessmentPayload> = {}, key: string = randomUUID()) => ({
    userId,
    conceptId,
    idempotencyKey: key,
    payload: payload(overrides),
  });

  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    pool = createPool();
    events = new LearnerEventsService(prisma);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.concept.deleteMany({ where: { id: { in: concepts } } });
    await prisma.$disconnect();
    await pool.end();
  });

  it('stores the event in the learner stream and projects it in the same step', async () => {
    const user = await newUser();
    const concept = await newConcept();
    const body = payload({ attemptId: 'attempt-1' });

    const result = await events.append({ userId: user, conceptId: concept, idempotencyKey: 'k-1', payload: body });

    expect(result).toMatchObject({ streamSeq: 1, duplicate: false });
    expect(result.state.score).toBeCloseTo(0.622, 3);
    const stored = await prisma.learningEvent.findUniqueOrThrow({ where: { id: result.eventId } });
    expect(stored).toMatchObject({
      userId: user,
      conceptId: concept,
      eventType: 'ASSESSMENT_COMPLETED',
      streamSeq: 1,
      schemaVersion: 1,
      idempotencyKey: 'k-1',
      entityType: 'QUIZ_ATTEMPT',
      entityId: 'attempt-1',
      payload: body,
    });
    const row = await prisma.conceptMastery.findUniqueOrThrow({ where: { userId_conceptId: { userId: user, conceptId: concept } } });
    expect(row).toMatchObject({ evidenceCount: 1, lastSeq: 1, modelVersion: MASTERY_MODEL_VERSION });
    expect(row.score).toBeCloseTo(0.622, 3);
    expect(await prisma.learnerStream.findUniqueOrThrow({ where: { userId: user } })).toMatchObject({ lastSeq: 1, modelVersion: MASTERY_MODEL_VERSION });
  });

  it('numbers events across concepts in one gapless stream per learner', async () => {
    const [user, other] = [await newUser(), await newUser()];
    const [a, b] = [await newConcept(), await newConcept()];

    const seqs = [
      (await events.append(input(user, a))).streamSeq,
      (await events.append(input(user, b))).streamSeq,
      (await events.append(input(other, a))).streamSeq,
      (await events.append(input(user, a))).streamSeq,
    ];

    expect(seqs).toEqual([1, 2, 1, 3]);
  });

  it('answers a repeated idempotency key with the stored event and changes nothing', async () => {
    const user = await newUser();
    const concept = await newConcept();
    const first = await events.append(input(user, concept, {}, 'same'));

    const again = await events.append(input(user, concept, { score: 0 }, 'same'));

    expect(again).toMatchObject({ duplicate: true, eventId: first.eventId, streamSeq: 1 });
    expect(again.state).toEqual(first.state);
    expect(await prisma.learningEvent.count({ where: { userId: user } })).toBe(1);
    expect((await prisma.conceptMastery.findFirstOrThrow({ where: { userId: user } })).evidenceCount).toBe(1);
  });

  it('keeps the sequence gapless and the projection exact under concurrent appends', async () => {
    const user = await newUser();
    const [a, b] = [await newConcept(), await newConcept()];

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => events.append(input(user, i % 2 === 0 ? a : b, { score: (i % 5) / 4 }))),
    );

    expect(results.map((r) => r.streamSeq).sort((x, y) => x - y)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(await prisma.learnerStream.findUniqueOrThrow({ where: { userId: user } })).toMatchObject({ lastSeq: 12 });
    expect(await events.rebuild(user)).toEqual({ changed: [], removed: [], skipped: [] });
  });

  it('records one event when the same key arrives concurrently', async () => {
    const user = await newUser();
    const concept = await newConcept();

    const results = await Promise.all(Array.from({ length: 6 }, () => events.append(input(user, concept, {}, 'race'))));

    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(new Set(results.map((r) => r.eventId)).size).toBe(1);
    expect(await prisma.learningEvent.count({ where: { userId: user } })).toBe(1);
  });

  it('refuses a payload with an unknown key or an impossible value and writes nothing', async () => {
    const user = await newUser();
    const concept = await newConcept();

    await expect(events.append({ ...input(user, concept), payload: { ...payload(), extra: 1 } as AssessmentPayload })).rejects.toThrow();
    await expect(events.append(input(user, concept, { score: 1.5 }))).rejects.toThrow();
    await expect(events.append(input(user, concept, { share: 0 }))).rejects.toThrow();

    expect(await prisma.learningEvent.count({ where: { userId: user } })).toBe(0);
    expect(await prisma.learnerStream.count({ where: { userId: user } })).toBe(0);
  });

  it('refuses an unknown concept and a deprecated one', async () => {
    const user = await newUser();
    const deprecated = await newConcept('DEPRECATED');

    await expect(events.append(input(user, 'no-such-concept'))).rejects.toThrow(/concept/i);
    await expect(events.append(input(user, deprecated))).rejects.toThrow(/deprecated|not active/i);

    expect(await prisma.learnerStream.count({ where: { userId: user } })).toBe(0);
  });

  it('joins the transaction of its caller, so a later failure removes the event too', async () => {
    const user = await newUser();
    const concept = await newConcept();

    await expect(
      prisma.$transaction(async (tx) => {
        await events.append(input(user, concept), tx);
        throw new Error('grading failed');
      }),
    ).rejects.toThrow('grading failed');

    expect(await prisma.learningEvent.count({ where: { userId: user } })).toBe(0);
    expect(await prisma.conceptMastery.count({ where: { userId: user } })).toBe(0);
  });

  it('rebuilds exactly what the incremental projection holds', async () => {
    const user = await newUser();
    const [a, b] = [await newConcept(), await newConcept()];
    await events.append(input(user, a, { score: 0.4 }));
    await events.append(input(user, b, { score: 0.9, hintsUsed: 2, share: 0.5 }));
    await events.append(input(user, a, { score: 1, attemptNumber: 2, quizId: 'quiz-1' }));
    await events.append(input(user, a, { score: 0.2, items: 1 }));

    expect(await events.rebuild(user)).toEqual({ changed: [], removed: [], skipped: [] });
  });

  it('repairs a projection that was altered, deleted or left over', async () => {
    const user = await newUser();
    const [a, b, ghost] = [await newConcept(), await newConcept(), await newConcept()];
    await events.append(input(user, a, { score: 0.4 }));
    await events.append(input(user, b, { score: 0.9 }));
    const expected = await prisma.conceptMastery.findUniqueOrThrow({ where: { userId_conceptId: { userId: user, conceptId: a } } });
    await prisma.conceptMastery.update({ where: { userId_conceptId: { userId: user, conceptId: a } }, data: { score: 0.99 } });
    await prisma.conceptMastery.delete({ where: { userId_conceptId: { userId: user, conceptId: b } } });
    await prisma.conceptMastery.create({
      data: { userId: user, conceptId: ghost, theta: 1, score: 0.7, confidence: 0.1, evidenceCount: 4, lastEventAt: new Date(), lastSeq: 9, modelVersion: MASTERY_MODEL_VERSION },
    });

    const result = await events.rebuild(user);

    expect(result.changed.sort()).toEqual([a, b].sort());
    expect(result.removed).toEqual([ghost]);
    const repaired = await prisma.conceptMastery.findUniqueOrThrow({ where: { userId_conceptId: { userId: user, conceptId: a } } });
    expect(repaired.id).toBe(expected.id);
    expect(repaired).toMatchObject({ evidenceCount: expected.evidenceCount, lastSeq: expected.lastSeq, modelVersion: expected.modelVersion });
    expect(repaired.theta).toBeCloseTo(expected.theta, 9);
    expect(repaired.score).toBeCloseTo(expected.score, 9);
    expect(repaired.confidence).toBeCloseTo(expected.confidence, 9);
    expect(await prisma.conceptMastery.count({ where: { userId: user } })).toBe(2);
  });

  it('ignores legacy events that have no place in a stream', async () => {
    const user = await newUser();
    const concept = await newConcept();
    await pool.query(
      `INSERT INTO "LearningEvent" (id, "userId", "eventType", payload) VALUES (gen_random_uuid(), $1, 'LESSON_COMPLETED', '{}'::jsonb)`,
      [user],
    );
    await events.append(input(user, concept));

    expect(await events.rebuild(user)).toEqual({ changed: [], removed: [], skipped: [] });
  });

  it('recomputes under the current formula before appending when the stream was built by another version', async () => {
    const user = await newUser();
    const concept = await newConcept();
    await events.append(input(user, concept, { score: 0.4 }));
    await prisma.conceptMastery.updateMany({ where: { userId: user }, data: { score: 0.01, theta: -4.6, modelVersion: 'mastery-v0' } });
    await prisma.learnerStream.update({ where: { userId: user }, data: { modelVersion: 'mastery-v0' } });

    await events.append(input(user, concept, { score: 1 }));

    expect(await prisma.learnerStream.findUniqueOrThrow({ where: { userId: user } })).toMatchObject({ modelVersion: MASTERY_MODEL_VERSION, lastSeq: 2 });
    expect(await events.rebuild(user)).toEqual({ changed: [], removed: [], skipped: [] });
  });

  it('rebuilds a learner who has no events to an empty projection', async () => {
    const user = await newUser();

    expect(await events.rebuild(user)).toEqual({ changed: [], removed: [], skipped: [] });
  });
});
