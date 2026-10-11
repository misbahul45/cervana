import { describe, expect, it } from 'vitest';
import type { ConceptMasteryEntry } from '~/interfaces/sandbox';
import { masteryTone, summarizeMastery, toPercent } from '~/lib/mastery';

const entry = (overrides: Partial<ConceptMasteryEntry> = {}): ConceptMasteryEntry => ({
  conceptId: 'c1',
  title: 'Persamaan Akuntansi',
  level: 1,
  score: 0.5,
  confidence: 0.1,
  evidenceCount: 1,
  lastEventAt: null,
  passed: false,
  mastered: false,
  ...overrides,
});

describe('toPercent', () => {
  it('rounds a 0 to 1 score to a whole percent and keeps it between 0 and 100', () => {
    expect(toPercent(0.8198)).toBe(82);
    expect(toPercent(0.125)).toBe(13);
    expect(toPercent(-0.2)).toBe(0);
    expect(toPercent(1.4)).toBe(100);
  });
});

describe('summarizeMastery', () => {
  it('is all zero for a learner without evidence', () => {
    expect(summarizeMastery([])).toEqual({ conceptsStarted: 0, averagePercent: 0, masteredCount: 0 });
  });

  it('counts the concepts, averages their scores and counts only the mastered flag from the server', () => {
    const summary = summarizeMastery([
      entry({ score: 0.95, passed: true, mastered: true }),
      entry({ conceptId: 'c2', score: 0.75, passed: true }),
      entry({ conceptId: 'c3', score: 0.55 }),
    ]);

    expect(summary).toEqual({ conceptsStarted: 3, averagePercent: 75, masteredCount: 1 });
  });

  it('does not decide mastery from the score itself', () => {
    expect(summarizeMastery([entry({ score: 0.99, mastered: false })]).masteredCount).toBe(0);
  });
});

describe('masteryTone', () => {
  it('is success for a mastered concept, primary for a passed one and warning otherwise', () => {
    expect(masteryTone(entry({ mastered: true, passed: true }))).toBe('success');
    expect(masteryTone(entry({ passed: true }))).toBe('primary');
    expect(masteryTone(entry())).toBe('warning');
  });
});
