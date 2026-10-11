import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANDING_FACTS } from '~/lib/landing-facts';
import { THEME_ICON_NAMES } from '~/theme/icons';

const API = join(__dirname, '../../../../../services/api');
const read = (relative: string) => readFileSync(join(API, relative), 'utf8');
const numberAfter = (source: string, label: RegExp): number => Number(label.exec(source)?.[1]);

describe('landing facts match the implementation they advertise', () => {
  it('counts the concepts of the registry seed', () => {
    const graph = JSON.parse(read('prisma/seed-data/golden-accounting-graph.json')) as { levels: Array<{ topics: unknown[] }> };

    expect(graph.levels.reduce((sum, level) => sum + level.topics.length, 0)).toBe(LANDING_FACTS.concepts);
  });

  it('counts the seeded achievements', () => {
    const source = read('src/v1/gamify/seed/default-catalog.ts');

    expect((source.match(/\{ code: '/g) ?? []).length).toBe(LANDING_FACTS.achievements);
  });

  it('counts the theme icons of the vocabulary', () => {
    expect(THEME_ICON_NAMES.length).toBe(LANDING_FACTS.icons);
  });

  it('states the reward values of the default rules', () => {
    const rules = read('src/v1/gamify/rewards/reward-rules.ts');

    expect(numberAfter(rules, /const DEFAULT_PASS_POINTS = (\d+);/)).toBe(LANDING_FACTS.xpPerConceptPassed);
    expect(numberAfter(rules, /const DEFAULT_STREAK_EVERY = (\d+);/)).toBe(LANDING_FACTS.streakBonusEvery);
  });

  it('states the streak freeze cap and the pass rule', () => {
    expect(numberAfter(read('src/v1/gamify/streaks/streak-fold.ts'), /freezeMax: (\d+) \}/)).toBe(LANDING_FACTS.streakFreezeMax);
    const policy = read('src/v1/learner-model/policy/learner-policy.service.ts');

    expect(numberAfter(policy, /export const PASS_SCORE = ([\d.]+);/)).toBe(LANDING_FACTS.passScore);
    expect(numberAfter(policy, /export const PASS_EVIDENCE = (\d+);/)).toBe(LANDING_FACTS.passEvidence);
  });

  it('counts the default level thresholds', () => {
    const source = read('src/v1/gamify/me/level-progress.ts');
    const block = source.slice(source.indexOf('DEFAULT_LEVELS'));

    expect((block.match(/\{ level: \d+, xp: \d+ \}/g) ?? []).length).toBe(LANDING_FACTS.levels);
  });
});
