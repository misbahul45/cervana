import { AchievementEvaluator, MetricSource } from '../achievement-evaluator';

const catalog = [
  { id: 'a1', code: 'first-assessment', title: 'Penilaian pertama', description: 'x', iconName: 'badge', rule: { metric: 'ASSESSMENTS_COMPLETED', op: '>=', value: 1 }, sortOrder: 1, active: true },
  { id: 'a2', code: 'five-assessments', title: 'Lima penilaian', description: 'x', iconName: 'badge', rule: { metric: 'ASSESSMENTS_COMPLETED', op: '>=', value: 5 }, sortOrder: 2, active: true },
  { id: 'a3', code: 'streak-7', title: 'Tujuh hari', description: 'x', iconName: 'streak', rule: { metric: 'STREAK_DAYS', op: '>=', value: 7 }, sortOrder: 3, active: true },
  { id: 'a4', code: 'broken', title: 'Aturan rusak', description: 'x', iconName: 'star', rule: { metric: 'LOGIN_COUNT', op: '>=', value: 1 }, sortOrder: 4, active: true },
  { id: 'a5', code: 'no-rule', title: 'Tanpa aturan', description: 'x', iconName: 'star', rule: null, sortOrder: 5, active: true },
  { id: 'a6', code: 'off', title: 'Dimatikan', description: 'x', iconName: 'star', rule: { metric: 'XP_TOTAL', op: '>=', value: 1 }, sortOrder: 6, active: false },
];

const build = (values: Record<string, number>, unlocked: Array<{ achievementId: string; awardedAt: Date }> = []) => {
  const created: Array<{ userId: string; achievementId: string }> = [];
  const tx = {
    achievement: { findMany: jest.fn(async ({ where }: { where: { active: boolean } }) => catalog.filter((c) => c.active === where.active)) },
    userAchievement: {
      findMany: jest.fn().mockResolvedValue(unlocked),
      createMany: jest.fn(async ({ data }: { data: Array<{ userId: string; achievementId: string }> }) => {
        created.push(...data);
        return { count: data.length };
      }),
    },
  };
  const source: MetricSource = { values: jest.fn(async (_userId, metrics) => Object.fromEntries([...metrics].map((m) => [m, values[m] ?? 0]))) };
  return { evaluator: new AchievementEvaluator(source), tx, source, created };
};

describe('AchievementEvaluator.evaluate', () => {
  it('unlocks every achievement whose rule is satisfied and reports them in catalog order', async () => {
    const { evaluator, tx, created } = build({ ASSESSMENTS_COMPLETED: 5, STREAK_DAYS: 3 });

    const result = await evaluator.evaluate('u1', tx as never);

    expect(result.map((r) => r.code)).toEqual(['first-assessment', 'five-assessments']);
    expect(created).toEqual([
      { userId: 'u1', achievementId: 'a1' },
      { userId: 'u1', achievementId: 'a2' },
    ]);
    expect(result[0]).toEqual({ code: 'first-assessment', title: 'Penilaian pertama', iconName: 'badge' });
  });

  it('skips what the learner already has and does not ask for a metric nobody still needs', async () => {
    const { evaluator, tx, source, created } = build(
      { ASSESSMENTS_COMPLETED: 9, STREAK_DAYS: 2 },
      [{ achievementId: 'a1', awardedAt: new Date() }, { achievementId: 'a2', awardedAt: new Date() }],
    );

    const result = await evaluator.evaluate('u1', tx as never);

    expect(result).toEqual([]);
    expect(created).toEqual([]);
    expect((source.values as jest.Mock).mock.calls[0][1]).toEqual(new Set(['STREAK_DAYS']));
  });

  it('ignores inactive achievements, achievements without a rule and rules it cannot parse', async () => {
    const { evaluator, tx, created } = build({ XP_TOTAL: 999, LOGIN_COUNT: 5 });

    expect(await evaluator.evaluate('u1', tx as never)).toEqual([]);
    expect(created).toEqual([]);
  });

  it('writes with skipDuplicates so a concurrent unlock is a no-op, and reports only what was really created', async () => {
    const { evaluator, tx } = build({ ASSESSMENTS_COMPLETED: 1 });
    tx.userAchievement.createMany.mockResolvedValueOnce({ count: 0 });

    const result = await evaluator.evaluate('u1', tx as never);

    expect(tx.userAchievement.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(result).toEqual([]);
  });

  it('asks for nothing when everything is unlocked', async () => {
    const { evaluator, tx, source } = build({}, catalog.map((c) => ({ achievementId: c.id, awardedAt: new Date() })));

    expect(await evaluator.evaluate('u1', tx as never)).toEqual([]);
    expect(source.values).not.toHaveBeenCalled();
  });
});

describe('AchievementEvaluator.progressFor', () => {
  it('lists the active catalog with unlocked state, capped progress and the unlock time', async () => {
    const awardedAt = new Date('2026-10-09T10:00:00Z');
    const { evaluator, tx } = build({ ASSESSMENTS_COMPLETED: 3, STREAK_DAYS: 9 }, [{ achievementId: 'a3', awardedAt }]);

    const list = await evaluator.progressFor('u1', tx as never);

    expect(list.map((a) => [a.code, a.unlocked, a.progress.value, a.progress.target])).toEqual([
      ['first-assessment', true, 1, 1],
      ['five-assessments', false, 3, 5],
      ['streak-7', true, 7, 7],
    ]);
    expect(list[2].unlockedAt).toEqual(awardedAt);
    expect(list[1]).toMatchObject({ title: 'Lima penilaian', iconName: 'badge' });
  });
});
