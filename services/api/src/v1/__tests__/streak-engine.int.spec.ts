import { Pool } from 'pg';
import { AuditService } from '@/common/authz/audit.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { RewardLedgerService } from '@/v1/gamify/rewards/reward-ledger.service';
import { RewardRulesService } from '@/v1/gamify/rewards/reward-rules.service';
import { StreakEngineService } from '@/v1/gamify/streaks/streak-engine.service';
import { replayStreak } from '@/v1/gamify/streaks/streak-fold';
import { createPool, databaseUrl, describeDb, insertUser } from '@/test-utils/pg-fixtures';

describeDb('streak engine (requires TEST_DATABASE_URL)', () => {
  let prisma: PrismaService;
  let pool: Pool;
  let engine: StreakEngineService;
  const users: string[] = [];

  const newUser = async (timezone?: string) => {
    const id = await insertUser(pool);
    users.push(id);
    if (timezone) await prisma.user.update({ where: { id }, data: { timezone } });
    return id;
  };

  const qualify = (userId: string, at: string) => prisma.$transaction((tx) => engine.onQualified({ userId, at: new Date(at) }, tx));
  const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}T05:00:00Z`;
  const learner = (userId: string) => prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { currentStreak: true, longestStreak: true, streakFreezes: true, lastStreakDate: true, totalPoints: true } });
  const history = async (userId: string) => (await prisma.streakHistory.findMany({ where: { userId }, orderBy: { date: 'asc' } })).map((r) => r.date.toISOString().slice(0, 10));

  beforeAll(() => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    pool = createPool();
    const ledger = new RewardLedgerService(prisma, new AuditService(prisma));
    engine = new StreakEngineService(ledger, new RewardRulesService());
  });

  afterAll(async () => {
    await prisma.leaderboardScore.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
    await pool.end();
  });

  it('starts a streak on the first qualified event and writes the day', async () => {
    const user = await newUser();

    const outcome = await qualify(user, day(1));

    expect(outcome).toMatchObject({ current: 1, longest: 1, freezes: 0, extended: true, bonusPoints: 0 });
    expect(await learner(user)).toMatchObject({ currentStreak: 1, longestStreak: 1, streakFreezes: 0 });
    expect(await history(user)).toEqual(['2026-10-01']);
    const row = await prisma.streakHistory.findFirstOrThrow({ where: { userId: user } });
    expect(row).toMatchObject({ activityType: 'QUIZ', streakCount: 1 });
  });

  it('counts a second event on the same local day as nothing', async () => {
    const user = await newUser();
    await qualify(user, '2026-10-01T01:00:00Z');

    const again = await qualify(user, '2026-10-01T09:00:00Z');

    expect(again.extended).toBe(false);
    expect(await history(user)).toEqual(['2026-10-01']);
    expect(await learner(user)).toMatchObject({ currentStreak: 1 });
  });

  it('draws the day boundary in the time zone of the learner', async () => {
    const jakarta = await newUser('Asia/Jakarta');
    const utc = await newUser('UTC');

    await qualify(jakarta, '2026-10-10T18:30:00Z');
    await qualify(utc, '2026-10-10T18:30:00Z');

    expect(await history(jakarta)).toEqual(['2026-10-11']);
    expect(await history(utc)).toEqual(['2026-10-10']);
  });

  it('earns a freeze and pays the bonus on the 7th day, once, and the next on the 14th', async () => {
    const user = await newUser();

    for (let n = 1; n <= 7; n += 1) await qualify(user, day(n));
    expect(await learner(user)).toMatchObject({ currentStreak: 7, streakFreezes: 1, totalPoints: 50 });

    for (let n = 8; n <= 14; n += 1) await qualify(user, day(n));
    expect(await learner(user)).toMatchObject({ currentStreak: 14, streakFreezes: 2, totalPoints: 100 });

    const bonuses = await prisma.gamificationLedger.findMany({ where: { userId: user, ruleId: 'STREAK_BONUS_7' }, orderBy: { createdAt: 'asc' } });
    expect(bonuses).toHaveLength(2);
    expect(bonuses[0]).toMatchObject({ kind: 'XP', points: 50, sourceType: 'STREAK' });
  });

  it('spends a freeze on a missed day and keeps the streak (GM-04)', async () => {
    const user = await newUser();
    for (let n = 1; n <= 7; n += 1) await qualify(user, day(n));

    const outcome = await qualify(user, day(9));

    expect(outcome).toMatchObject({ current: 8, freezes: 0, freezesUsed: 1, extended: true });
    expect(await learner(user)).toMatchObject({ currentStreak: 8, streakFreezes: 0 });
  });

  it('resets to 1 after a missed day without a freeze and keeps the longest streak', async () => {
    const user = await newUser();
    for (let n = 1; n <= 3; n += 1) await qualify(user, day(n));

    const outcome = await qualify(user, day(6));

    expect(outcome).toMatchObject({ current: 1, longest: 3, freezesUsed: 0 });
    expect(await learner(user)).toMatchObject({ currentStreak: 1, longestStreak: 3 });
  });

  it('writes one day once when the same event arrives concurrently', async () => {
    const user = await newUser();

    const results = await Promise.all(Array.from({ length: 24 }, () => qualify(user, day(1))));

    expect(results.filter((r) => r.extended)).toHaveLength(1);
    expect(await history(user)).toEqual(['2026-10-01']);
    expect(await learner(user)).toMatchObject({ currentStreak: 1 });
  });

  it('counts three consecutive days once each when events of those days arrive concurrently', async () => {
    const user = await newUser();
    await qualify(user, day(1));

    const results = await Promise.all([2, 2, 2, 2, 3, 3, 3, 3].map((n) => qualify(user, day(n))));

    expect(results.filter((r) => r.extended).length).toBeLessThanOrEqual(2);
    const stored = await learner(user);
    expect(stored.currentStreak).toBe((await history(user)).length);
    expect(stored.currentStreak).toBeGreaterThanOrEqual(2);
  });

  it('keeps the stored counters equal to a replay of the stored days', async () => {
    const user = await newUser();
    for (const n of [1, 2, 3, 4, 5, 6, 7, 9, 10, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]) await qualify(user, day(n));

    const stored = await learner(user);
    const replayed = replayStreak(await history(user));

    expect({ current: stored.currentStreak, longest: stored.longestStreak, freezes: stored.streakFreezes, lastDate: stored.lastStreakDate?.toISOString().slice(0, 10) }).toEqual(replayed);
  });

  it('does nothing for a user that does not exist', async () => {
    const outcome = await qualify('00000000-0000-4000-8000-000000000000', day(1));

    expect(outcome.extended).toBe(false);
  });
});
