import { ACHIEVEMENT_METRICS, parseAchievementRule, ruleSatisfied } from '../achievement-rule';

describe('parseAchievementRule', () => {
  it('accepts a metric, the >= operator and a positive whole value', () => {
    for (const metric of ACHIEVEMENT_METRICS) {
      expect(parseAchievementRule({ metric, op: '>=', value: 3 })).toEqual({ metric, op: '>=', value: 3 });
    }
  });

  it('knows exactly six metrics', () => {
    expect([...ACHIEVEMENT_METRICS].sort()).toEqual(['ASSESSMENTS_COMPLETED', 'CONCEPTS_PASSED', 'LEVEL', 'NODES_MASTERED', 'STREAK_DAYS', 'XP_TOTAL']);
  });

  it('refuses anything else: unknown metric, other operator, zero, negative, fraction, text, extra keys, non objects', () => {
    for (const bad of [
      { metric: 'LOGIN_COUNT', op: '>=', value: 3 },
      { metric: 'LEVEL', op: '>', value: 3 },
      { metric: 'LEVEL', op: '>=', value: 0 },
      { metric: 'LEVEL', op: '>=', value: -1 },
      { metric: 'LEVEL', op: '>=', value: 2.5 },
      { metric: 'LEVEL', op: '>=', value: '3' },
      { metric: 'LEVEL', op: '>=', value: 3, expr: 'process.exit()' },
      { metric: 'LEVEL', op: '>=' },
      null,
      'LEVEL >= 3',
      [],
    ]) {
      expect(parseAchievementRule(bad)).toBeNull();
    }
  });
});

describe('ruleSatisfied', () => {
  it('is true at the threshold and above, false below', () => {
    const rule = { metric: 'STREAK_DAYS' as const, op: '>=' as const, value: 7 };

    expect(ruleSatisfied(rule, 6)).toBe(false);
    expect(ruleSatisfied(rule, 7)).toBe(true);
    expect(ruleSatisfied(rule, 30)).toBe(true);
  });
});
