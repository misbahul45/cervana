import { GamifyMeService } from '../gamify-me.service';

const NOW = new Date('2026-10-10T05:00:00Z');

const build = (overrides: { user?: Record<string, unknown> | null; levels?: Array<{ level: number; xp: number }>; days?: string[] } = {}) => {
  const user = overrides.user === undefined
    ? { totalPoints: 125, stars: 3, currentStreak: 4, longestStreak: 9, streakFreezes: 1, lastStreakDate: new Date('2026-10-09T00:00:00Z'), timezone: 'Asia/Jakarta', leaderboardOptIn: true, leaderboardHandle: 'budi_01' }
    : overrides.user;
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    levelThreshold: { findMany: jest.fn().mockResolvedValue(overrides.levels ?? []) },
    streakHistory: { findMany: jest.fn().mockResolvedValue((overrides.days ?? ['2026-10-07', '2026-10-08', '2026-10-09']).map((d) => ({ date: new Date(`${d}T00:00:00Z`) }))) },
  };
  return { service: new GamifyMeService(prisma as never, () => NOW), prisma };
};

describe('GamifyMeService', () => {
  it("reports the learner's xp, level progress, stars and streak from stored state", async () => {
    const { service } = build();

    const me = await service.get('u1');

    expect(me.xp).toBe(125);
    expect(me.level).toEqual({ level: 2, floor: 100, next: 150, progress: 0.5, toNext: 25 });
    expect(me.stars).toBe(3);
    expect(me.streak).toMatchObject({ current: 4, longest: 9, freezes: 1, lastDate: '2026-10-09', today: '2026-10-10', status: 'AT_RISK' });
    expect(me.streak.week.map((d) => d.state)).toEqual(['missed', 'missed', 'missed', 'done', 'done', 'done', 'today']);
    expect(me.board).toEqual({ optedIn: true, handle: 'budi_01' });
  });

  it('reads only the own rows', async () => {
    const { service, prisma } = build();

    await service.get('u1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }));
    expect(prisma.streakHistory.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }));
  });

  it('uses the thresholds stored in the database when there are some, and the defaults otherwise', async () => {
    const stored = build({ levels: [{ level: 1, xp: 0 }, { level: 2, xp: 50 }, { level: 3, xp: 120 }] });
    expect((await stored.service.get('u1')).level).toMatchObject({ level: 3, floor: 120, next: null });

    const fallback = build({ levels: [] });
    expect((await fallback.service.get('u1')).level).toMatchObject({ level: 2, next: 150 });
  });

  it('draws today in the time zone of the learner', async () => {
    const { service } = build({ user: { totalPoints: 0, stars: 0, currentStreak: 0, longestStreak: 0, streakFreezes: 0, lastStreakDate: null, timezone: 'America/Los_Angeles', leaderboardOptIn: false, leaderboardHandle: null }, days: [] });

    const me = await service.get('u1');

    expect(me.streak.today).toBe('2026-10-09');
    expect(me.streak.status).toBe('NONE');
    expect(me.board).toEqual({ optedIn: false, handle: null });
  });

  it('answers a learner that does not exist with a 404', async () => {
    const { service } = build({ user: null });

    await expect(service.get('ghost')).rejects.toMatchObject({ statusCode: 404 });
  });
});
