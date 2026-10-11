import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { Pool } from 'pg';
import { AuditService } from '@/common/authz/audit.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AppError } from '@/common/lib/error';
import { GrantInput, RewardLedgerService } from '@/v1/gamify/rewards/reward-ledger.service';
import { createPool, databaseUrl, describeDb, insertUser } from '@/test-utils/pg-fixtures';

describeDb('reward ledger service (requires TEST_DATABASE_URL)', () => {
  let prisma: PrismaService;
  let pool: Pool;
  let ledger: RewardLedgerService;
  const users: string[] = [];
  const topics: string[] = [];

  const newUser = async () => {
    const id = await insertUser(pool);
    users.push(id);
    return id;
  };

  const newTopic = async () => {
    const topic = await prisma.topic.create({
      data: { title: 'Reward fixture', slug: `reward-${randomUUID().slice(0, 8)}`, image: {}, price: 0, subTopics: { create: [{ title: 'S' }] } },
      include: { subTopics: true },
    });
    topics.push(topic.id);
    return { topicId: topic.id, subTopicId: topic.subTopics[0].id };
  };

  const grantInput = (userId: string, overrides: Partial<GrantInput> = {}): GrantInput => ({
    userId,
    ruleId: 'MASTERY_PROGRESS',
    ruleVersion: 1,
    points: 10,
    idempotencyKey: `k-${randomUUID()}`,
    sourceType: 'LEARNING_EVENT',
    sourceId: 'evt-1',
    ...overrides,
  });

  const rows = (userId: string) => prisma.leaderboardScore.findMany({ where: { userId }, orderBy: { id: 'asc' } });
  const sumOf = async (userId: string) => (await prisma.gamificationLedger.aggregate({ where: { userId }, _sum: { points: true } }))._sum.points ?? 0;

  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    pool = createPool();
    ledger = new RewardLedgerService(prisma, new AuditService(prisma));
  });

  afterAll(async () => {
    await prisma.leaderboardScore.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.topic.deleteMany({ where: { id: { in: topics } } });
    await prisma.$disconnect();
    await pool.end();
  });

  describe('grant', () => {
    it('stores the entry and projects it onto the global, topic and sub-topic rows', async () => {
      const user = await newUser();
      const { topicId, subTopicId } = await newTopic();

      const result = await ledger.grant(grantInput(user, { points: 12, topicId, subTopicId }));

      expect(result.duplicate).toBe(false);
      expect(result.entry).toMatchObject({ userId: user, points: 12, ruleId: 'MASTERY_PROGRESS', ruleVersion: 1, reversalOf: null, topicId, subTopicId });
      const projected = await rows(user);
      expect(projected.map((r) => [r.id, r.scope, r.score])).toEqual(
        [
          [`g-${user}`, 'GLOBAL', 12],
          [`st-${user}-${subTopicId}`, 'SUBTOPIC', 12],
          [`t-${user}-${topicId}`, 'TOPIC', 12],
        ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      );
      expect(projected.find((r) => r.scope === 'TOPIC')).toMatchObject({ topicId, subTopicId: null });
      expect(projected.find((r) => r.scope === 'SUBTOPIC')).toMatchObject({ topicId: null, subTopicId });
    });

    it('projects only the global row when the grant has no location', async () => {
      const user = await newUser();

      await ledger.grant(grantInput(user, { points: 50, ruleId: 'STREAK_BONUS_7', sourceType: 'STREAK' }));

      expect((await rows(user)).map((r) => [r.id, r.score])).toEqual([[`g-${user}`, 50]]);
    });

    it('adds up grants with different keys', async () => {
      const user = await newUser();
      const { topicId, subTopicId } = await newTopic();

      await ledger.grant(grantInput(user, { points: 12, topicId, subTopicId }));
      await ledger.grant(grantInput(user, { points: 8, topicId, subTopicId }));

      expect((await rows(user)).map((r) => r.score)).toEqual([20, 20, 20]);
      expect(await sumOf(user)).toBe(20);
    });

    it('returns the stored entry for a repeated key and changes nothing', async () => {
      const user = await newUser();
      const first = await ledger.grant(grantInput(user, { points: 12, idempotencyKey: `same-${user}` }));

      const again = await ledger.grant(grantInput(user, { points: 99, idempotencyKey: `same-${user}` }));

      expect(again).toMatchObject({ duplicate: true });
      expect(again.entry.id).toBe(first.entry.id);
      expect(again.entry.points).toBe(12);
      expect(await prisma.gamificationLedger.count({ where: { userId: user } })).toBe(1);
      expect((await rows(user)).map((r) => r.score)).toEqual([12]);
    });

    it('pays once when the same key arrives concurrently', async () => {
      const user = await newUser();

      const results = await Promise.all(Array.from({ length: 6 }, () => ledger.grant(grantInput(user, { points: 7, idempotencyKey: `race-${user}` }))));

      expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
      expect(new Set(results.map((r) => r.entry.id)).size).toBe(1);
      expect((await rows(user)).map((r) => r.score)).toEqual([7]);
    });

    it('adds up concurrent grants with different keys without losing an increment', async () => {
      const user = await newUser();

      await Promise.all(Array.from({ length: 15 }, (_, i) => ledger.grant(grantInput(user, { points: i + 1 }))));

      expect((await rows(user)).map((r) => r.score)).toEqual([120]);
      expect(await sumOf(user)).toBe(120);
    });

    it('joins the transaction of its caller, so a later failure removes the entry and the points', async () => {
      const user = await newUser();

      await expect(
        prisma.$transaction(async (tx) => {
          await ledger.grant(grantInput(user, { points: 30 }), tx);
          throw new Error('grading failed');
        }),
      ).rejects.toThrow('grading failed');

      expect(await prisma.gamificationLedger.count({ where: { userId: user } })).toBe(0);
      expect(await rows(user)).toEqual([]);
    });

    it('refuses a grant that is not positive or has no key', async () => {
      const user = await newUser();

      await expect(ledger.grant(grantInput(user, { points: 0 }))).rejects.toThrow();
      await expect(ledger.grant(grantInput(user, { points: -3 }))).rejects.toThrow();
      await expect(ledger.grant(grantInput(user, { points: 1.5 }))).rejects.toThrow();
      await expect(ledger.grant(grantInput(user, { idempotencyKey: '' }))).rejects.toThrow();

      expect(await prisma.gamificationLedger.count({ where: { userId: user } })).toBe(0);
    });
  });

  describe('reverse', () => {
    const admin = (suffix: string) => ({ actorId: `rl-admin-${suffix}`, actorRole: Role.ADMIN });

    it('appends the opposite entry, takes the points off the same rows and writes an audit entry', async () => {
      const user = await newUser();
      const { topicId, subTopicId } = await newTopic();
      const { entry } = await ledger.grant(grantInput(user, { points: 12, topicId, subTopicId }));

      const result = await ledger.reverse({ entryId: entry.id, reason: 'farmed', ...admin('a') });

      expect(result.duplicate).toBe(false);
      expect(result.entry).toMatchObject({ points: -12, reversalOf: entry.id, reason: 'farmed', actorId: 'rl-admin-a', ruleId: 'MASTERY_PROGRESS', userId: user });
      expect((await rows(user)).map((r) => r.score)).toEqual([0, 0, 0]);
      expect(await sumOf(user)).toBe(0);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: 'GamificationLedger', entityId: entry.id } });
      expect(audit).toMatchObject({ action: 'REWARD_REVERSED', actorId: 'rl-admin-a', actorRole: 'ADMIN', reason: 'farmed' });
      expect(audit.before).toMatchObject({ points: 12 });
      expect(audit.after).toMatchObject({ points: -12 });
    });

    it('answers a second reversal with the first and changes nothing', async () => {
      const user = await newUser();
      const { entry } = await ledger.grant(grantInput(user, { points: 12 }));
      const first = await ledger.reverse({ entryId: entry.id, reason: 'farmed', ...admin('b') });

      const second = await ledger.reverse({ entryId: entry.id, reason: 'again', ...admin('b') });

      expect(second.duplicate).toBe(true);
      expect(second.entry.id).toBe(first.entry.id);
      expect(await prisma.gamificationLedger.count({ where: { userId: user } })).toBe(2);
      expect((await rows(user)).map((r) => r.score)).toEqual([0]);
      expect(await prisma.auditLog.count({ where: { entityType: 'GamificationLedger', entityId: entry.id } })).toBe(1);
    });

    it('creates one reversal when the request arrives concurrently', async () => {
      const user = await newUser();
      const { entry } = await ledger.grant(grantInput(user, { points: 12 }));

      const results = await Promise.all(Array.from({ length: 5 }, () => ledger.reverse({ entryId: entry.id, reason: 'farmed', ...admin('c') })));

      expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
      expect((await rows(user)).map((r) => r.score)).toEqual([0]);
      expect(await prisma.gamificationLedger.count({ where: { userId: user, reversalOf: { not: null } } })).toBe(1);
    });

    it('refuses an unknown entry with 404 and a reversal with 409', async () => {
      const user = await newUser();
      const { entry } = await ledger.grant(grantInput(user, { points: 12 }));
      const reversal = await ledger.reverse({ entryId: entry.id, reason: 'farmed', ...admin('d') });

      await expect(ledger.reverse({ entryId: randomUUID(), reason: 'no such entry', ...admin('d') })).rejects.toMatchObject({ statusCode: 404 });
      await expect(ledger.reverse({ entryId: reversal.entry.id, reason: 'no such entry', ...admin('d') })).rejects.toMatchObject({ statusCode: 409 });
      await expect(ledger.reverse({ entryId: randomUUID(), reason: 'no such entry', ...admin('d') })).rejects.toBeInstanceOf(AppError);
    });

    it('refuses an empty reason', async () => {
      const user = await newUser();
      const { entry } = await ledger.grant(grantInput(user, { points: 12 }));

      await expect(ledger.reverse({ entryId: entry.id, reason: '  ', ...admin('e') })).rejects.toThrow();

      expect(await prisma.gamificationLedger.count({ where: { userId: user, reversalOf: { not: null } } })).toBe(0);
    });
  });

  describe('history', () => {
    it("lists the learner's entries newest first with the balance, reversals included, and nobody else's", async () => {
      const user = await newUser();
      const other = await newUser();
      const a = await ledger.grant(grantInput(user, { points: 12 }));
      await new Promise((resolve) => setTimeout(resolve, 5));
      await ledger.grant(grantInput(user, { points: 8 }));
      await ledger.reverse({ entryId: a.entry.id, reason: 'farmed', actorId: 'rl-admin-h', actorRole: Role.ADMIN });
      await ledger.grant(grantInput(other, { points: 99 }));

      const history = await ledger.history(user, { limit: 10 });

      expect(history.balance).toBe(8);
      expect(history.entries.map((e) => e.points)).toEqual([-12, 8, 12]);
      expect(history.entries.every((e) => e.userId === user)).toBe(true);
    });

    it('clamps the page size', async () => {
      const user = await newUser();
      for (let i = 0; i < 3; i += 1) await ledger.grant(grantInput(user, { points: 1 }));

      expect((await ledger.history(user, { limit: 2 })).entries).toHaveLength(2);
      expect((await ledger.history(user, { limit: 0 })).entries).toHaveLength(1);
      expect((await ledger.history(user, { limit: 100000 })).entries).toHaveLength(3);
      expect((await ledger.history(user, { limit: 2 })).balance).toBe(3);
    });
  });

  it('keeps the global row equal to the ledger sum through any mix of grants and reversals', async () => {
    const user = await newUser();
    const { topicId, subTopicId } = await newTopic();
    const granted: string[] = [];
    let seed = 5;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    for (let i = 0; i < 30; i += 1) {
      if (granted.length > 0 && random() < 0.3) {
        const index = Math.floor(random() * granted.length);
        const [entryId] = granted.splice(index, 1);
        await ledger.reverse({ entryId, reason: 'sweep', actorId: 'rl-admin-p', actorRole: Role.ADMIN });
      } else {
        const located = random() < 0.5;
        const { entry } = await ledger.grant(grantInput(user, { points: 1 + Math.floor(random() * 50), ...(located ? { topicId, subTopicId } : {}) }));
        granted.push(entry.id);
      }
    }

    const global = await prisma.leaderboardScore.findUniqueOrThrow({ where: { id: `g-${user}` } });
    expect(global.score).toBe(await sumOf(user));
  });

  describe('kinds and learner projections', () => {
    const counters = async (userId: string) => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totalPoints: true, stars: true } });
      return user;
    };

    it('defaults to XP, adds XP to the learner total and takes it off again on a reversal', async () => {
      const user = await newUser();

      const granted = await ledger.grant(grantInput(user, { points: 30 }));

      expect(granted.entry.kind).toBe('XP');
      expect(await counters(user)).toEqual({ totalPoints: 30, stars: 0 });
      await ledger.reverse({ entryId: granted.entry.id, reason: 'fraud check', actorId: 'admin-1', actorRole: Role.ADMIN });
      expect(await counters(user)).toEqual({ totalPoints: 0, stars: 0 });
    });

    it('adds a STAR entry to the star counter only, never to the total or to a board', async () => {
      const user = await newUser();
      const { subTopicId } = await newTopic();

      const granted = await ledger.grant(grantInput(user, { kind: 'STAR', ruleId: 'PATH_NODE_MASTERED', points: 1, sourceType: 'NODE', sourceId: subTopicId, subTopicId }));

      expect(granted.entry.kind).toBe('STAR');
      expect(await counters(user)).toEqual({ totalPoints: 0, stars: 1 });
      expect(await rows(user)).toHaveLength(0);
    });

    it('reverses a STAR entry as a STAR entry and takes the star off', async () => {
      const user = await newUser();
      const granted = await ledger.grant(grantInput(user, { kind: 'STAR', ruleId: 'PATH_NODE_MASTERED', points: 2, sourceType: 'NODE' }));

      const reversal = await ledger.reverse({ entryId: granted.entry.id, reason: 'node was unlocked by mistake', actorId: 'admin-1', actorRole: Role.ADMIN });

      expect(reversal.entry).toMatchObject({ kind: 'STAR', points: -2 });
      expect(await counters(user)).toEqual({ totalPoints: 0, stars: 0 });
    });

    it('reports the XP balance and the star balance apart', async () => {
      const user = await newUser();
      await ledger.grant(grantInput(user, { points: 40 }));
      await ledger.grant(grantInput(user, { kind: 'STAR', ruleId: 'PATH_NODE_MASTERED', points: 3, sourceType: 'NODE' }));

      const history = await ledger.history(user);

      expect(history.balance).toBe(40);
      expect(history.starBalance).toBe(3);
      expect(history.entries.map((e) => e.kind).sort()).toEqual(['STAR', 'XP']);
    });

    it('keeps both counters equal to the ledger sums under concurrent grants of both kinds', async () => {
      const user = await newUser();

      await Promise.all([
        ...Array.from({ length: 5 }, (_, n) => ledger.grant(grantInput(user, { points: 10, idempotencyKey: `xp-${user}-${n}` }))),
        ...Array.from({ length: 5 }, (_, n) => ledger.grant(grantInput(user, { kind: 'STAR', ruleId: 'PATH_NODE_MASTERED', points: 1, sourceType: 'NODE', idempotencyKey: `st-${user}-${n}` }))),
      ]);

      expect(await counters(user)).toEqual({ totalPoints: 50, stars: 5 });
      const history = await ledger.history(user, { limit: 100 });
      expect([history.balance, history.starBalance]).toEqual([50, 5]);
    });
  });
});
