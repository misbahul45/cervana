import { THEME_ICON_NAMES } from '../../themes/theme-icons';
import { parseAchievementRule } from '../../achievements/achievement-rule';
import { DEFAULT_ACHIEVEMENTS } from '../default-catalog';

describe('default achievement catalog', () => {
  it('has unique codes, unique sort orders and Indonesian text', () => {
    expect(new Set(DEFAULT_ACHIEVEMENTS.map((a) => a.code)).size).toBe(DEFAULT_ACHIEVEMENTS.length);
    expect(new Set(DEFAULT_ACHIEVEMENTS.map((a) => a.sortOrder)).size).toBe(DEFAULT_ACHIEVEMENTS.length);
    for (const achievement of DEFAULT_ACHIEVEMENTS) {
      expect(achievement.title.trim().length).toBeGreaterThan(2);
      expect(achievement.description.trim().length).toBeGreaterThan(10);
    }
  });

  it('only uses rules the evaluator can parse and icons from the closed vocabulary', () => {
    for (const achievement of DEFAULT_ACHIEVEMENTS) {
      expect(parseAchievementRule(achievement.rule)).toEqual(achievement.rule);
      expect(THEME_ICON_NAMES as ReadonlyArray<string>).toContain(achievement.iconName);
    }
  });

  it('climbs: for each metric the thresholds grow with the sort order', () => {
    const byMetric = new Map<string, number[]>();
    for (const achievement of [...DEFAULT_ACHIEVEMENTS].sort((a, b) => a.sortOrder - b.sortOrder)) {
      byMetric.set(achievement.rule.metric, [...(byMetric.get(achievement.rule.metric) ?? []), achievement.rule.value]);
    }
    for (const values of byMetric.values()) {
      expect(values).toEqual([...values].sort((a, b) => a - b));
    }
  });

  it('covers assessments, concepts, nodes, streak and level, and promises nothing about logins or chat', () => {
    const metrics = new Set(DEFAULT_ACHIEVEMENTS.map((a) => a.rule.metric));

    expect([...metrics].sort()).toEqual(['ASSESSMENTS_COMPLETED', 'CONCEPTS_PASSED', 'LEVEL', 'NODES_MASTERED', 'STREAK_DAYS']);
    for (const achievement of DEFAULT_ACHIEVEMENTS) {
      expect(`${achievement.title} ${achievement.description}`.toLowerCase()).not.toMatch(/login|masuk harian|chat|pesan/);
    }
  });
});
