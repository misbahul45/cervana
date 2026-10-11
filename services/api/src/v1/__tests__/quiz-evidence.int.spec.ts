import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { QuizAttemptsService } from '@/v1/quiz/quiz-attempts/quiz-attempts.service';
import { QuizEvaluationService } from '@/v1/quiz/services/quiz-evaluation.service';
import { ConceptRegistryService } from '@/v1/learner-model/concepts/concept-registry.service';
import { LearnerEventsService } from '@/v1/learner-model/events/learner-events.service';
import { RewardEngineService } from '@/v1/gamify/rewards/reward-engine.service';
import { RewardLedgerService } from '@/v1/gamify/rewards/reward-ledger.service';
import { AuditService } from '@/common/authz/audit.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { REGISTRY_SUITE_LOCK, createPool, databaseUrl, describeDb, holdSuiteLock, insertUser } from '@/test-utils/pg-fixtures';

describeDb('quiz submission appends learning evidence (requires TEST_DATABASE_URL)', () => {
  let prisma: PrismaService;
  let pool: Pool;
  let events: LearnerEventsService;
  let service: QuizAttemptsService;
  let releaseLock: () => Promise<void>;
  const ids = { concepts: [] as string[], topics: [] as string[], users: [] as string[] };

  const fixture = async (links: Array<{ concept: string; target: 'lesson' | 'subTopic'; status?: 'APPROVED' | 'PROPOSED' }>) => {
    const concepts = Array.from(new Set(links.map((l) => l.concept)));
    for (const id of concepts) {
      await prisma.concept.upsert({ where: { id }, create: { id, title: id, level: 1, sortOrder: 1 }, update: {} });
      if (!ids.concepts.includes(id)) ids.concepts.push(id);
    }
    const topic = await prisma.topic.create({
      data: {
        title: 'Evidence fixture',
        slug: `evidence-${randomUUID().slice(0, 8)}`,
        image: {},
        price: 0,
        subTopics: { create: [{ title: 'S', lessons: { create: [{ title: 'L' }] } }] },
      },
      include: { subTopics: { include: { lessons: true } } },
    });
    ids.topics.push(topic.id);
    const subTopic = topic.subTopics[0];
    const lesson = subTopic.lessons[0];
    for (const link of links) {
      await prisma.conceptCurriculumLink.create({
        data: {
          id: `fixture:${randomUUID()}`,
          conceptId: link.concept,
          status: link.status ?? 'APPROVED',
          ...(link.target === 'lesson' ? { lessonId: lesson.id } : { subTopicId: subTopic.id }),
        },
      });
    }
    const quiz = await prisma.quiz.create({
      data: {
        title: 'Lesson quiz',
        lessonId: lesson.id,
        questions: {
          create: [
            { question: 'one', options: ['A', 'B'], correctAnswer: 'A', points: 1, sortOrder: 1 },
            { question: 'two', options: ['A', 'B'], correctAnswer: 'A', points: 1, sortOrder: 2 },
          ],
        },
      },
      include: { questions: true },
    });
    const user = await insertUser(pool);
    ids.users.push(user);
    return { quiz, user, lesson };
  };

  const attempt = (userId: string, quizId: string) => service.startAttempt({ id: userId, role: 'STUDENT' }, { quizId });

  const answers = (quiz: { questions: Array<{ id: string }> }, choices: string[]) =>
    Object.fromEntries(quiz.questions.map((q, i) => [q.id, choices[i]]));

  const submit = async (userId: string, quiz: { id: string; questions: Array<{ id: string }> }, choices: string[]) => {
    const started = await attempt(userId, quiz.id);
    return service.submitAttempt({ userId, attemptId: started.data.id, answers: answers(quiz, choices) });
  };

  beforeAll(async () => {
    releaseLock = await holdSuiteLock(REGISTRY_SUITE_LOCK);
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    pool = createPool();
    events = new LearnerEventsService(prisma);
    service = new QuizAttemptsService(
      {} as never,
      prisma,
      undefined,
      undefined,
      new QuizEvaluationService(),
      new ConceptRegistryService(prisma),
      events,
      new RewardEngineService(new RewardLedgerService(prisma, new AuditService(prisma))),
    );
  }, 120_000);

  afterAll(async () => {
    await prisma.leaderboardScore.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    await prisma.topic.deleteMany({ where: { id: { in: ids.topics } } });
    await prisma.concept.deleteMany({ where: { id: { in: ids.concepts } } });
    await prisma.$disconnect();
    await pool.end();
    await releaseLock();
  });

  it('turns a lesson quiz submission into a stored event and a mastery row', async () => {
    const concept = `qe-${randomUUID().slice(0, 8)}`;
    const { quiz, user } = await fixture([{ concept, target: 'lesson' }]);

    const result = await submit(user, quiz, ['A', 'A']);

    expect(result.score).toBe(100);
    const stored = await prisma.learningEvent.findMany({ where: { userId: user } });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ conceptId: concept, streamSeq: 1, entityType: 'QUIZ_ATTEMPT' });
    expect(stored[0].payload).toMatchObject({ score: 1, items: 2, share: 1, attemptNumber: 1, hintsUsed: 0 });
    const row = await prisma.conceptMastery.findFirstOrThrow({ where: { userId: user, conceptId: concept } });
    expect(row.evidenceCount).toBe(1);
    expect(row.score).toBeGreaterThan(0.5);
  });

  it('weighs a retake of the same quiz less than the first attempt', async () => {
    const concept = `qe-${randomUUID().slice(0, 8)}`;
    const { quiz, user } = await fixture([{ concept, target: 'lesson' }]);

    await submit(user, quiz, ['A', 'A']);
    const afterFirst = (await prisma.conceptMastery.findFirstOrThrow({ where: { userId: user, conceptId: concept } })).theta;
    await submit(user, quiz, ['A', 'A']);
    const afterSecond = (await prisma.conceptMastery.findFirstOrThrow({ where: { userId: user, conceptId: concept } })).theta;

    const events2 = await prisma.learningEvent.findMany({ where: { userId: user }, orderBy: { streamSeq: 'asc' } });
    expect(events2.map((e) => (e.payload as { attemptNumber: number }).attemptNumber)).toEqual([1, 2]);
    expect(afterSecond - afterFirst).toBeLessThan(afterFirst / 2);
    expect(afterSecond).toBeGreaterThan(afterFirst);
  });

  it('records a failed attempt as evidence against the concept', async () => {
    const concept = `qe-${randomUUID().slice(0, 8)}`;
    const { quiz, user } = await fixture([{ concept, target: 'lesson' }]);

    await submit(user, quiz, ['B', 'B']);

    expect((await prisma.conceptMastery.findFirstOrThrow({ where: { userId: user, conceptId: concept } })).score).toBeLessThan(0.5);
  });

  it('credits every approved concept of a sub-topic link an equal share', async () => {
    const [a, b] = [`qe-${randomUUID().slice(0, 8)}`, `qe-${randomUUID().slice(0, 8)}`];
    const { quiz, user } = await fixture([
      { concept: a, target: 'subTopic' },
      { concept: b, target: 'subTopic' },
    ]);

    await submit(user, quiz, ['A', 'A']);

    const stored = await prisma.learningEvent.findMany({ where: { userId: user }, orderBy: { streamSeq: 'asc' } });
    expect(stored.map((e) => [e.conceptId, (e.payload as { share: number }).share]).sort()).toEqual([[a, 0.5], [b, 0.5]].sort());
    expect(stored.map((e) => e.streamSeq)).toEqual([1, 2]);
  });

  it('writes nothing for a link that is only proposed', async () => {
    const concept = `qe-${randomUUID().slice(0, 8)}`;
    const { quiz, user } = await fixture([{ concept, target: 'lesson', status: 'PROPOSED' }]);

    await submit(user, quiz, ['A', 'A']);

    expect(await prisma.learningEvent.count({ where: { userId: user } })).toBe(0);
  });

  it('rolls the whole submission back when the event cannot be written', async () => {
    const [a, b] = [`qe-${randomUUID().slice(0, 8)}`, `qe-${randomUUID().slice(0, 8)}`];
    const { quiz, user } = await fixture([
      { concept: a, target: 'lesson' },
      { concept: b, target: 'lesson' },
    ]);
    const started = await attempt(user, quiz.id);
    const original = events.append.bind(events);
    const spy = jest.spyOn(events, 'append').mockImplementation(async (input, tx) => {
      if (input.conceptId === b) throw new Error('stream unavailable');
      return original(input, tx);
    });

    await expect(service.submitAttempt({ userId: user, attemptId: started.data.id, answers: answers(quiz, ['A', 'A']) })).rejects.toThrow('stream unavailable');
    spy.mockRestore();

    expect((await prisma.quizAttempt.findUniqueOrThrow({ where: { id: started.data.id } })).status).toBe('IN_PROGRESS');
    expect(await prisma.learningEvent.count({ where: { userId: user } })).toBe(0);
    expect(await prisma.conceptMastery.count({ where: { userId: user } })).toBe(0);
  });

  it('does not count a submitted attempt twice', async () => {
    const concept = `qe-${randomUUID().slice(0, 8)}`;
    const { quiz, user } = await fixture([{ concept, target: 'lesson' }]);
    const started = await attempt(user, quiz.id);
    const body = { userId: user, attemptId: started.data.id, answers: answers(quiz, ['A', 'A']) };

    await service.submitAttempt(body);
    await expect(service.submitAttempt(body)).rejects.toThrow(/already submitted/i);

    expect(await prisma.learningEvent.count({ where: { userId: user } })).toBe(1);
  });

  describe('points', () => {
    const ledgerOf = (userId: string) => prisma.gamificationLedger.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const rowsOf = (userId: string) => prisma.leaderboardScore.findMany({ where: { userId }, orderBy: { scope: 'asc' } });

    it('pays the progress of a first attempt into the ledger and the three leaderboard rows', async () => {
      const concept = `qe-${randomUUID().slice(0, 8)}`;
      const { quiz, user } = await fixture([{ concept, target: 'lesson' }]);

      await submit(user, quiz, ['A', 'A']);

      const entries = await ledgerOf(user);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ ruleId: 'MASTERY_PROGRESS', ruleVersion: 1, points: 4, conceptId: concept, sourceType: 'LEARNING_EVENT' });
      const stored = await prisma.learningEvent.findFirstOrThrow({ where: { userId: user } });
      expect(entries[0]).toMatchObject({ sourceId: stored.id, idempotencyKey: `reward:MASTERY_PROGRESS:v1:${stored.id}` });
      expect(entries[0].topicId).toBeTruthy();
      expect(entries[0].subTopicId).toBeTruthy();
      const rows = await rowsOf(user);
      expect(rows.map((r) => [r.scope, r.score]).sort()).toEqual([['GLOBAL', 4], ['SUBTOPIC', 4], ['TOPIC', 4]]);
    });

    it('pays less for each retake and never twice for the same attempt', async () => {
      const concept = `qe-${randomUUID().slice(0, 8)}`;
      const { quiz, user } = await fixture([{ concept, target: 'lesson' }]);

      await submit(user, quiz, ['A', 'A']);
      await submit(user, quiz, ['A', 'A']);
      await submit(user, quiz, ['A', 'A']);

      const points = (await ledgerOf(user)).map((e) => e.points);
      expect(points.length).toBeGreaterThanOrEqual(2);
      expect(points[0]).toBeGreaterThan(points[points.length - 1]);
      const total = points.reduce((sum, p) => sum + p, 0);
      expect((await prisma.leaderboardScore.findUniqueOrThrow({ where: { id: `g-${user}` } })).score).toBe(total);
      expect(await prisma.gamificationLedger.count({ where: { userId: user, idempotencyKey: { startsWith: 'reward:MASTERY_PROGRESS' } } })).toBe(points.length);
    });

    it('pays nothing for a failed attempt, a hinted attempt or a quiz without approved concepts', async () => {
      const concept = `qe-${randomUUID().slice(0, 8)}`;
      const failed = await fixture([{ concept, target: 'lesson' }]);
      const proposed = await fixture([{ concept, target: 'lesson', status: 'PROPOSED' }]);
      const hinted = await fixture([{ concept, target: 'lesson' }]);

      await submit(failed.user, failed.quiz, ['B', 'B']);
      await submit(proposed.user, proposed.quiz, ['A', 'A']);
      const started = await attempt(hinted.user, hinted.quiz.id);
      await service.submitAttempt({ userId: hinted.user, attemptId: started.data.id, answers: answers(hinted.quiz, ['A', 'A']), hintUsed: true });

      for (const user of [failed.user, proposed.user, hinted.user]) {
        expect(await ledgerOf(user)).toEqual([]);
        expect(await rowsOf(user)).toEqual([]);
      }
    });

    it('rolls the attempt, the event and the reward back together when the ledger fails', async () => {
      const concept = `qe-${randomUUID().slice(0, 8)}`;
      const { quiz, user } = await fixture([{ concept, target: 'lesson' }]);
      const started = await attempt(user, quiz.id);
      const spy = jest.spyOn(RewardLedgerService.prototype, 'grant').mockRejectedValueOnce(new Error('ledger down'));

      await expect(service.submitAttempt({ userId: user, attemptId: started.data.id, answers: answers(quiz, ['A', 'A']) })).rejects.toThrow('ledger down');
      spy.mockRestore();

      expect((await prisma.quizAttempt.findUniqueOrThrow({ where: { id: started.data.id } })).status).toBe('IN_PROGRESS');
      expect(await prisma.learningEvent.count({ where: { userId: user } })).toBe(0);
      expect(await ledgerOf(user)).toEqual([]);
      expect(await rowsOf(user)).toEqual([]);
    });
  });
});
