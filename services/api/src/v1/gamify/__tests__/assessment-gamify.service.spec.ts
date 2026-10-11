import { AssessmentGamifyService } from '../assessment-gamify.service';

const streakOutcome = (overrides: Record<string, unknown> = {}) => ({
  current: 3,
  longest: 5,
  freezes: 1,
  lastDate: '2026-10-10',
  extended: true,
  freezeEarned: false,
  freezesUsed: 0,
  bonusPoints: 0,
  ...overrides,
});

const build = (overrides: { stars?: number; streak?: Record<string, unknown>; unlocked?: Array<{ code: string; title: string; iconName: string | null }> } = {}) => {
  const calls: string[] = [];
  const nodes = { onAssessment: jest.fn(async () => { calls.push('nodes'); return { stars: overrides.stars ?? 0 }; }) };
  const streaks = { onQualified: jest.fn(async () => { calls.push('streak'); return streakOutcome(overrides.streak); }) };
  const achievements = { evaluate: jest.fn(async () => { calls.push('achievements'); return overrides.unlocked ?? []; }) };
  const service = new AssessmentGamifyService(nodes as never, streaks as never, achievements as never);
  return { service, nodes, streaks, achievements, calls };
};

const at = new Date('2026-10-10T05:00:00Z');
const tx = { marker: 'tx' } as never;

describe('AssessmentGamifyService.afterAssessment', () => {
  it('runs node stars, then the streak, then achievements, all in the callers transaction', async () => {
    const { service, nodes, streaks, achievements, calls } = build();

    await service.afterAssessment({ userId: 'u1', subTopicId: 'sub-1', at, xpGained: 12 }, tx);

    expect(calls).toEqual(['nodes', 'streak', 'achievements']);
    expect(nodes.onAssessment).toHaveBeenCalledWith({ userId: 'u1', subTopicId: 'sub-1' }, tx);
    expect(streaks.onQualified).toHaveBeenCalledWith({ userId: 'u1', at }, tx);
    expect(achievements.evaluate).toHaveBeenCalledWith('u1', tx);
  });

  it('adds the streak bonus to the xp of the assessment and reports stars, the streak and what unlocked', async () => {
    const { service } = build({
      stars: 1,
      streak: { current: 7, freezeEarned: true, bonusPoints: 50 },
      unlocked: [{ code: 'streak-7', title: 'Tujuh hari', iconName: 'streak' }],
    });

    const outcome = await service.afterAssessment({ userId: 'u1', subTopicId: 'sub-1', at, xpGained: 12 }, tx);

    expect(outcome).toEqual({
      xpGained: 62,
      starsGained: 1,
      streak: { current: 7, longest: 5, freezes: 1, extended: true, freezeEarned: true, freezesUsed: 0, bonusPoints: 50 },
      achievements: [{ code: 'streak-7', title: 'Tujuh hari', iconName: 'streak' }],
    });
  });

  it('asks the achievements last, so a streak or a star of this very assessment can unlock one', async () => {
    const { service, calls } = build();

    await service.afterAssessment({ userId: 'u1', subTopicId: null, at, xpGained: 0 }, tx);

    expect(calls[calls.length - 1]).toBe('achievements');
  });

  it('lets a failure of any step reach the caller, so the whole grading rolls back', async () => {
    const { service, streaks, achievements } = build();
    streaks.onQualified.mockRejectedValueOnce(new Error('streak down'));

    await expect(service.afterAssessment({ userId: 'u1', subTopicId: 'sub-1', at, xpGained: 1 }, tx)).rejects.toThrow('streak down');
    expect(achievements.evaluate).not.toHaveBeenCalled();
  });
});
