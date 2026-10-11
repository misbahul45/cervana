import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { Pool } from 'pg';
import { AuditService } from '@/common/authz/audit.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AchievementEvaluator } from '@/v1/gamify/achievements/achievement-evaluator';
import { PrismaMetricSource } from '@/v1/gamify/achievements/prisma-metric-source';
import { RewardLedgerService } from '@/v1/gamify/rewards/reward-ledger.service';
import { LearnerEventsService } from '@/v1/learner-model/events/learner-events.service';
import { createPool, databaseUrl, describeDb, insertUser } from '@/test-utils/pg-fixtures';

describeDb('achievement metrics and unlocking (requires TEST_DATABASE_URL)', () => {
  let prisma: PrismaService;
  let pool: Pool;
  let source: PrismaMetricSource;
  let events: LearnerEventsService;
  let ledger: RewardLedgerService;
  let evaluator: AchievementEvaluator;
  const users: string[] = [];
  const concepts: string[] = [];
  const achievements: string[] = [];
  const tag = randomUUID().slice(0, 8);

  const newUser = async () => {
    const id = await insertUser(pool);
    users.push(id);
    return id;
  };

  const newConcept = async () => {
    const id = `am-${tag}-${concepts.length}`;
    await prisma.concept.create({ data: { id, title: id, level: 1, sortOrder: 1 } });
    concepts.push(id);
    return id;
  };

  const assess = (userId: string, conceptId: string, attemptId: string) =>
    events.append({ userId, conceptId, idempotencyKey: `${attemptId}:${conceptId}`, payload: { attemptId, quizId: 'q', score: 1, items: 5, hintsUsed: 0, share: 1, attemptNumber: 1 } });

  const metrics = (userId: string, wanted: string[]) =>
    prisma.$transaction((tx) => source.values(userId, new Set(wanted as never), tx));

  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    pool = createPool();
    source = new PrismaMetricSource();
    events = new LearnerEventsService(prisma);
    ledger = new RewardLedgerService(prisma, new AuditService(prisma));
    evaluator = new AchievementEvaluator(source);
  });

  afterAll(async () => {
    await prisma.leaderboardScore.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.achievement.deleteMany({ where: { id: { in: achievements } } });
    await prisma.concept.deleteMany({ where: { id: { in: concepts } } });
    await prisma.$disconnect();
    await pool.end();
  });

  it('counts an assessment once however many concepts it touched', async () => {
    const user = await newUser();
    const a = await newConcept();
    const b = await newConcept();
    await assess(user, a, 'attempt-1');
    await assess(user, b, 'attempt-1');
    await assess(user, a, 'attempt-2');

    expect(await metrics(user, ['ASSESSMENTS_COMPLETED'])).toEqual({ ASSESSMENTS_COMPLETED: 2 });
  });

  it('counts a concept as passed only with the pass score and the minimum evidence', async () => {
    const user = await newUser();
    const strong = await newConcept();
    const thin = await newConcept();
    for (let n = 0; n < 4; n += 1) await assess(user, strong, `s-${n}`);
    await assess(user, thin, 't-0');
    await assess(user, thin, 't-1');

    expect(await metrics(user, ['CONCEPTS_PASSED'])).toEqual({ CONCEPTS_PASSED: 1 });
  });

  it('counts mastered nodes from star entries that were not reversed', async () => {
    const user = await newUser();
    const first = await ledger.grant({ userId: user, kind: 'STAR', ruleId: 'PATH_NODE_MASTERED', ruleVersion: 1, points: 1, idempotencyKey: `n1-${user}`, sourceType: 'NODE' });
    await ledger.grant({ userId: user, kind: 'STAR', ruleId: 'PATH_NODE_MASTERED', ruleVersion: 1, points: 1, idempotencyKey: `n2-${user}`, sourceType: 'NODE' });
    expect(await metrics(user, ['NODES_MASTERED'])).toEqual({ NODES_MASTERED: 2 });

    await ledger.reverse({ entryId: first.entry.id, reason: 'granted by mistake', actorId: 'admin-1', actorRole: Role.ADMIN });

    expect(await metrics(user, ['NODES_MASTERED'])).toEqual({ NODES_MASTERED: 1 });
  });

  it('reads the longest streak, the xp and the level from the learner and the stored thresholds', async () => {
    const user = await newUser();
    await prisma.user.update({ where: { id: user }, data: { longestStreak: 9, currentStreak: 2, totalPoints: 420 } });

    expect(await metrics(user, ['STREAK_DAYS', 'XP_TOTAL', 'LEVEL'])).toEqual({ STREAK_DAYS: 9, XP_TOTAL: 420, LEVEL: 5 });
  });

  it('computes the level from the thresholds stored in the database when there are any', async () => {
    const user = await newUser();
    await prisma.user.update({ where: { id: user }, data: { totalPoints: 420 } });
    const previous = await prisma.levelThreshold.findMany();
    await prisma.levelThreshold.deleteMany();
    await prisma.levelThreshold.createMany({ data: [{ level: 1, xp: 0 }, { level: 2, xp: 10 }] });

    try {
      expect(await metrics(user, ['LEVEL'])).toEqual({ LEVEL: 2 });
    } finally {
      await prisma.levelThreshold.deleteMany();
      if (previous.length > 0) await prisma.levelThreshold.createMany({ data: previous });
    }
  });

  it('answers only the metrics that were asked for', async () => {
    const user = await newUser();

    expect(Object.keys(await metrics(user, ['XP_TOTAL']))).toEqual(['XP_TOTAL']);
    expect(await metrics(user, [])).toEqual({});
  });

  it('unlocks an achievement once, from real evidence, and not again', async () => {
    const user = await newUser();
    const concept = await newConcept();
    const created = await prisma.achievement.create({
      data: { code: `first-${tag}`, title: 'Penilaian pertama', type: 'QUIZ', iconName: 'badge', rule: { metric: 'ASSESSMENTS_COMPLETED', op: '>=', value: 1 }, sortOrder: -1000 },
    });
    achievements.push(created.id);

    expect((await prisma.$transaction((tx) => evaluator.evaluate(user, tx))).map((a) => a.code)).not.toContain(`first-${tag}`);

    await assess(user, concept, 'unlock-1');
    const first = await prisma.$transaction((tx) => evaluator.evaluate(user, tx));
    const second = await prisma.$transaction((tx) => evaluator.evaluate(user, tx));

    expect(first.map((a) => a.code)).toContain(`first-${tag}`);
    expect(second.map((a) => a.code)).not.toContain(`first-${tag}`);
    expect(await prisma.userAchievement.count({ where: { userId: user, achievementId: created.id } })).toBe(1);
  });

  it('keeps one unlock row when two evaluations run at the same time', async () => {
    const user = await newUser();
    const concept = await newConcept();
    const created = await prisma.achievement.create({
      data: { code: `race-${tag}`, title: 'Balapan', type: 'QUIZ', iconName: 'badge', rule: { metric: 'ASSESSMENTS_COMPLETED', op: '>=', value: 1 }, sortOrder: -999 },
    });
    achievements.push(created.id);
    await assess(user, concept, 'race-1');

    const results = await Promise.all(Array.from({ length: 6 }, () => prisma.$transaction((tx) => evaluator.evaluate(user, tx))));

    expect(results.flat().filter((a) => a.code === `race-${tag}`)).toHaveLength(1);
    expect(await prisma.userAchievement.count({ where: { userId: user, achievementId: created.id } })).toBe(1);
  });
});
