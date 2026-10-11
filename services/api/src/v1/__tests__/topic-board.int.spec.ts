import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { Pool } from 'pg';
import { AuditService } from '@/common/authz/audit.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { TopicBoardService } from '@/v1/gamify/leaderboards/topic-board.service';
import { RewardLedgerService } from '@/v1/gamify/rewards/reward-ledger.service';
import { createPool, databaseUrl, describeDb, insertUser } from '@/test-utils/pg-fixtures';

const NOW = new Date('2026-10-10T05:00:00Z');
const IN_WEEK = new Date('2026-10-07T05:00:00Z');
const BEFORE_WEEK = new Date('2026-09-30T05:00:00Z');

describeDb('topic board (requires TEST_DATABASE_URL)', () => {
  let prisma: PrismaService;
  let pool: Pool;
  let ledger: RewardLedgerService;
  let board: TopicBoardService;
  const users: string[] = [];
  const topics: string[] = [];
  const concepts: string[] = [];
  const tag = randomUUID().slice(0, 6);

  const newTopic = async () => {
    const topic = await prisma.topic.create({ data: { title: 'Board topic', slug: `board-${randomUUID().slice(0, 8)}`, image: {}, price: 0 } });
    topics.push(topic.id);
    return topic.id;
  };

  const newUser = async (handle: string | null, optIn: boolean) => {
    const id = await insertUser(pool);
    users.push(id);
    if (handle) await prisma.user.update({ where: { id }, data: { leaderboardHandle: `${handle}_${tag}`.slice(0, 20), leaderboardOptIn: optIn } });
    return id;
  };

  const passed = async (userId: string, topicId: string, at: Date, key = randomUUID()) => {
    const conceptId = `tb-${tag}-${concepts.length}`;
    await prisma.concept.create({ data: { id: conceptId, title: conceptId, level: 1, sortOrder: 1 } });
    concepts.push(conceptId);
    const id = randomUUID();
    await pool.query(
      `INSERT INTO "GamificationLedger" (id, "userId", "ruleId", "ruleVersion", points, "idempotencyKey", "sourceType", "conceptId", "topicId", "createdAt")
       VALUES ($1, $2, 'CONCEPT_PASSED', 1, 50, $3, 'LEARNING_EVENT', $4, $5, $6)`,
      [id, userId, `tb-${key}`, conceptId, topicId, at],
    );
    return { id };
  };

  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    pool = createPool();
    ledger = new RewardLedgerService(prisma, new AuditService(prisma));
    board = new TopicBoardService(prisma, () => NOW);
  });

  afterAll(async () => {
    await prisma.leaderboardScore.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.topic.deleteMany({ where: { id: { in: topics } } });
    await prisma.concept.deleteMany({ where: { id: { in: concepts } } });
    await prisma.$disconnect();
    await pool.end();
  });

  it('ranks opted in learners of the topic by concepts first passed this week, with a handle and no identity', async () => {
    const topic = await newTopic();
    const a = await newUser('ani', true);
    const b = await newUser('budi', true);
    const c = await newUser('cici', true);
    await passed(a, topic, IN_WEEK);
    await passed(b, topic, IN_WEEK);
    await passed(b, topic, IN_WEEK);
    await passed(c, topic, IN_WEEK);
    await passed(c, topic, IN_WEEK);
    await passed(c, topic, IN_WEEK);

    const result = await board.board(a, topic);

    expect(result.entries.map((e) => [e.rank, e.score])).toEqual([[1, 3], [2, 2], [3, 1]]);
    expect(result.entries.map((e) => e.handle)).toEqual([`cici_${tag}`, `budi_${tag}`, `ani_${tag}`]);
    expect(result.entries.map((e) => e.you)).toEqual([false, false, true]);
    expect(result.me).toEqual({ optedIn: true, rank: 3, score: 1 });
    for (const entry of result.entries) expect(Object.keys(entry).sort()).toEqual(['handle', 'rank', 'score', 'you']);
  });

  it('leaves out learners who did not opt in, even with more passes, and learners without a handle', async () => {
    const topic = await newTopic();
    const shown = await newUser('shown', true);
    const hidden = await newUser('hidden', false);
    const nameless = await newUser(null, false);
    await passed(shown, topic, IN_WEEK);
    for (let n = 0; n < 4; n += 1) await passed(hidden, topic, IN_WEEK);
    await passed(nameless, topic, IN_WEEK);

    const result = await board.board(shown, topic);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ handle: `shown_${tag}`, rank: 1, score: 1 });
  });

  it('counts only passes of this topic inside the current week', async () => {
    const topic = await newTopic();
    const other = await newTopic();
    const user = await newUser('weekly', true);
    await passed(user, topic, IN_WEEK);
    await passed(user, topic, BEFORE_WEEK);
    await passed(user, other, IN_WEEK);
    await passed(user, topic, new Date('2026-10-12T05:00:00Z'));

    const result = await board.board(user, topic);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].score).toBe(1);
  });

  it('does not count a pass that was reversed', async () => {
    const topic = await newTopic();
    const user = await newUser('reverse', true);
    const entry = await passed(user, topic, IN_WEEK);
    await passed(user, topic, IN_WEEK);
    await ledger.reverse({ entryId: entry.id, reason: 'granted by mistake', actorId: 'admin-1', actorRole: Role.ADMIN });

    expect((await board.board(user, topic)).entries[0].score).toBe(1);
  });

  it('breaks a tie in favour of the learner who reached the score first', async () => {
    const topic = await newTopic();
    const late = await newUser('late', true);
    const early = await newUser('early', true);
    await passed(late, topic, new Date('2026-10-09T05:00:00Z'));
    await passed(early, topic, new Date('2026-10-06T05:00:00Z'));

    const result = await board.board(late, topic);

    expect(result.entries.map((e) => e.handle)).toEqual([`early_${tag}`, `late_${tag}`]);
    expect(result.entries.map((e) => e.rank)).toEqual([1, 2]);
  });

  it('shows the own rank even beyond the page, and none for a learner who is not on the board', async () => {
    const topic = await newTopic();
    const leaders = [await newUser('l1', true), await newUser('l2', true), await newUser('l3', true)];
    for (const [i, id] of leaders.entries()) for (let n = 0; n <= 3 - i; n += 1) await passed(id, topic, IN_WEEK);
    const me = await newUser('last', true);
    await passed(me, topic, IN_WEEK);
    const outsider = await newUser('out', false);
    await passed(outsider, topic, IN_WEEK);

    const page = await board.board(me, topic, { limit: 2 });
    const hidden = await board.board(outsider, topic);

    expect(page.entries).toHaveLength(2);
    expect(page.me).toEqual({ optedIn: true, rank: 4, score: 1 });
    expect(hidden.me).toEqual({ optedIn: false, rank: null, score: 1 });
    expect(hidden.entries.some((e) => e.you)).toBe(false);
  });

  it('is empty for a topic nobody passed anything in', async () => {
    const topic = await newTopic();
    const user = await newUser('quiet', true);

    expect(await board.board(user, topic)).toMatchObject({ entries: [], me: { optedIn: true, rank: null, score: 0 } });
  });

  describe('membership', () => {
    it('sets the handle and the opt in, keeps the handle unique and needs a handle to opt in', async () => {
      const a = await newUser(null, false);
      const b = await newUser(null, false);
      const handle = `mem_${tag}`;

      await expect(board.updateMembership(a, { optIn: true })).rejects.toMatchObject({ statusCode: 400 });
      expect(await board.updateMembership(a, { optIn: true, handle })).toEqual({ optedIn: true, handle });
      await expect(board.updateMembership(b, { optIn: true, handle })).rejects.toMatchObject({ statusCode: 409 });
      expect(await board.updateMembership(a, { optIn: false })).toEqual({ optedIn: false, handle });
      expect(await board.updateMembership(a, { optIn: true })).toEqual({ optedIn: true, handle });
      expect(await board.updateMembership(a, { handle: `new_${tag}` })).toEqual({ optedIn: true, handle: `new_${tag}` });
    });
  });
});
