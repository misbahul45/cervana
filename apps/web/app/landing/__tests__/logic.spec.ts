import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNTING_LEVELS,
  LEVEL_ONE_TOPICS,
  TOPIC_TOTAL,
} from '../catalog';
import {
  DEBIT_CREDIT_TOPIC_ID,
  EQUATION_TOPIC_ID,
  HERO_LEARNER,
  JOURNAL_TOPIC_ID,
  STORY_STEPS,
  frameAt,
} from '../demo-story';
import {
  DEFAULT_EXPERIENCE,
  SESSION_TIERS,
  applyProposal,
  initialSnapshot,
  interpretUtterance,
  presetProposal,
  snapSessionMinutes,
  validateProposal,
} from '../experience';
import { layoutGraph, nodeStates } from '../graph-layout';
import { resolveLocale } from '../locale';
import {
  MASTERY_THRESHOLD,
  REMEDIATION_THRESHOLD,
  decideNextTopic,
  emptyPolicySnapshot,
  decideStrategy,
  strategyForPercent,
} from '../policy';
import { composeSession, totalMinutes } from '../session';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const SEED_PATH = path.join(REPO_ROOT, 'services/api/prisma/seed-data/golden-accounting-graph.json');

describe('catalog parity with the API golden graph seed', () => {
  it('matches level sizes, total and level one prerequisites', () => {
    if (!fs.existsSync(SEED_PATH)) return;
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')) as {
      levels: Array<{ id: number; topics: Array<{ id: string; prerequisites: string[] }> }>;
    };
    expect(seed.levels.map((level) => level.topics.length)).toEqual(
      ACCOUNTING_LEVELS.map((level) => level.topicCount),
    );
    expect(seed.levels.reduce((sum, level) => sum + level.topics.length, 0)).toBe(TOPIC_TOTAL);
    const levelOne = seed.levels.find((level) => level.id === 1)!;
    expect(LEVEL_ONE_TOPICS.map((topic) => ({ id: topic.id, prerequisites: [...topic.prerequisites] }))).toEqual(
      levelOne.topics.map((topic) => ({ id: topic.id, prerequisites: topic.prerequisites })),
    );
    const allIds = new Set(seed.levels.flatMap((level) => level.topics.map((topic) => topic.id)));
    for (const level of ACCOUNTING_LEVELS) {
      for (const id of level.sampleTopicIds) expect(allIds.has(id)).toBe(true);
      if (level.entryPrerequisiteId) expect(allIds.has(level.entryPrerequisiteId)).toBe(true);
    }
  });

  it('totals 65 concepts', () => {
    expect(TOPIC_TOTAL).toBe(65);
  });
});

describe('next topic policy mirrors the API thresholds', () => {
  it('uses 0.5 for remediation and 0.7 for mastery', () => {
    expect(REMEDIATION_THRESHOLD).toBe(0.5);
    expect(MASTERY_THRESHOLD).toBe(0.7);
  });

  it('starts at the first topic when nothing is recorded', () => {
    const decision = decideNextTopic({ mastery: {}, activeMisconceptionTopicIds: [] });
    expect(decision.topicId).toBe(EQUATION_TOPIC_ID);
    expect(decision.rationaleKind).toBe('no_exploration');
  });

  it('recovers an active misconception below 0.5', () => {
    const decision = decideNextTopic({
      mastery: { [EQUATION_TOPIC_ID]: 0.8, [DEBIT_CREDIT_TOPIC_ID]: 0.42 },
      activeMisconceptionTopicIds: [DEBIT_CREDIT_TOPIC_ID],
    });
    expect(decision.rationaleKind).toBe('remediation');
    expect(decision.topicId).toBe(DEBIT_CREDIT_TOPIC_ID);
  });

  it('does not recover when mastery is already at 0.5', () => {
    const decision = decideNextTopic({
      mastery: { [EQUATION_TOPIC_ID]: 0.8, [DEBIT_CREDIT_TOPIC_ID]: 0.5 },
      activeMisconceptionTopicIds: [DEBIT_CREDIT_TOPIC_ID],
    });
    expect(decision.rationaleKind).toBe('progression');
  });

  it('progresses to the first unpassed topic whose prerequisites reach 0.7', () => {
    const decision = decideNextTopic({
      mastery: { [EQUATION_TOPIC_ID]: 0.8, [DEBIT_CREDIT_TOPIC_ID]: 0.7 },
      activeMisconceptionTopicIds: [],
    });
    expect(decision.topicId).toBe(JOURNAL_TOPIC_ID);
    expect(decision.rationaleKind).toBe('progression');
  });
});

describe('strategy policy mirrors the API specification vectors', () => {
  const base = {
    intent: 'NEW_LEARNING' as const,
    learner: {
      mastery: 0.5,
      confidence: 0.5,
      evidenceCount: 5,
      openMisconceptionCount: 0,
      daysSinceLastReview: 1,
      consecutiveCorrect: 0,
      recentItemDifficulty: 0.5,
    },
    concept: { prerequisiteMasteryMet: true, isTransferEligible: true, difficulty: 0.5 },
    policy: emptyPolicySnapshot(),
  };

  it('keeps difficulty close to mastery inside the zone of proximal development', () => {
    const low = decideStrategy({
      ...base,
      learner: { ...base.learner, mastery: 0.3, recentItemDifficulty: 0.3 },
      concept: { ...base.concept, difficulty: 0.4 },
    });
    expect(low.difficultyTarget).toBeGreaterThanOrEqual(0.2);
    expect(low.difficultyTarget).toBeLessThanOrEqual(0.5);
    const high = decideStrategy({
      ...base,
      learner: { ...base.learner, mastery: 0.8, recentItemDifficulty: 0.8 },
      concept: { ...base.concept, difficulty: 0.7 },
    });
    expect(high.difficultyTarget).toBeGreaterThanOrEqual(0.7);
    expect(high.difficultyTarget).toBeLessThanOrEqual(0.95);
  });

  it('remediates with high scaffolding at two open misconceptions', () => {
    const decision = decideStrategy({ ...base, learner: { ...base.learner, openMisconceptionCount: 2 } });
    expect(decision.strategy).toBe('REMEDIATE');
    expect(decision.scaffoldLevel).toBe('HIGH');
  });

  it('answers low mastery doubt with a worked example and high mastery doubt with Socratic questions', () => {
    expect(strategyForPercent({
      intent: 'DOUBT', masteryPercent: 20, confidencePercent: 50, openMisconceptionCount: 0,
      daysSinceLastReview: 1, prerequisiteMasteryMet: true,
    }).strategy).toBe('WORKED_EXAMPLE');
    expect(strategyForPercent({
      intent: 'DOUBT', masteryPercent: 80, confidencePercent: 50, openMisconceptionCount: 0,
      daysSinceLastReview: 1, prerequisiteMasteryMet: true,
    }).strategy).toBe('SOCRATIC');
  });

  it('reviews after more than seven days and keeps the invariants', () => {
    const decision = strategyForPercent({
      intent: 'PRACTICE', masteryPercent: 60, confidencePercent: 50, openMisconceptionCount: 0,
      daysSinceLastReview: 8, prerequisiteMasteryMet: true,
    });
    expect(decision.strategy).toBe('REVIEW');
    expect([0, 1, 2, 3]).toContain(decision.hintLevel);
    expect(decision.maxAttempts).toBeGreaterThanOrEqual(1);
  });
});

describe('experience proposals', () => {
  it('accepts only whitelisted dimensions and values', () => {
    const decision = validateProposal({
      origin: 'external',
      utterance: 'x',
      changes: { css: 'body{display:none}', theme: 'javascript:alert(1)', difficulty: 9, motion: 'low' },
    });
    expect(decision.accepted).toEqual({ motion: 'low' });
    expect(decision.rejected).toEqual([
      { key: 'css', reason: 'unknown_dimension' },
      { key: 'theme', reason: 'invalid_value' },
      { key: 'difficulty', reason: 'invalid_value' },
    ]);
  });

  it('snaps typed minutes to a session tier', () => {
    expect(snapSessionMinutes(1)).toBe(2);
    expect(snapSessionMinutes(7)).toBe(5);
    expect(snapSessionMinutes(24)).toBe(20);
    expect(snapSessionMinutes(90)).toBe(25);
  });

  it('records a snapshot only when a value changes', () => {
    const first = applyProposal(initialSnapshot(), presetProposal('5', { sessionMinutes: 5 }));
    expect(first.adaptations).toBe(1);
    expect(first.values.sessionMinutes).toBe(5);
    expect(first.previous.sessionMinutes).toBe(20);
    const repeat = applyProposal(first, presetProposal('5', { sessionMinutes: 5 }));
    expect(repeat.adaptations).toBe(1);
    expect(repeat.changed).toEqual([]);
  });

  it.each([
    ['Aku hanya punya 5 menit', { sessionMinutes: 5 }],
    ['I only have 10 minutes', { sessionMinutes: 10 }],
    ['Jelaskan lebih sedikit dan beri aku pertanyaan', { teachingMode: 'socratic' }],
    ['Explain less and ask me questions', { teachingMode: 'socratic' }],
    ['Buat lebih menantang', { difficulty: 4 }],
    ['make it easier', { difficulty: 2 }],
    ['Buat lebih futuristik', { theme: 'futuristic' }],
    ['Make it less animated', { motion: 'low' }],
    ['Kurangi animasi', { motion: 'low' }],
    ['lebih banyak animasi', { motion: 'high' }],
  ])('interprets %s', (text, expected) => {
    expect(interpretUtterance(text, DEFAULT_EXPERIENCE).changes).toEqual(expected);
  });

  it('ignores markup and unknown requests', () => {
    expect(interpretUtterance('<script>alert(1)</script>', DEFAULT_EXPERIENCE).changes).toEqual({});
    expect(interpretUtterance('ubah warna latar jadi merah', DEFAULT_EXPERIENCE).changes).toEqual({});
  });

  it('clamps difficulty at the bounds', () => {
    const top = { ...DEFAULT_EXPERIENCE, difficulty: 5 as const };
    expect(interpretUtterance('harder', top).changes).toEqual({ difficulty: 5 });
  });
});

describe('session composition', () => {
  it.each(SESSION_TIERS)('fills exactly %i minutes with and without a misconception', (minutes) => {
    expect(totalMinutes(composeSession(minutes, true))).toBe(minutes);
    expect(totalMinutes(composeSession(minutes, false))).toBe(minutes);
  });

  it('puts the misconception review first when one is active', () => {
    expect(composeSession(5, true)[0]!.kind).toBe('misconception');
    expect(composeSession(5, false).some((step) => step.kind === 'misconception')).toBe(false);
  });
});

describe('concept graph', () => {
  const layout = layoutGraph();

  it('lays out nine columns and one edge per prerequisite', () => {
    expect(layout.columns).toBe(9);
    expect(layout.nodes).toHaveLength(16);
    expect(layout.edges).toHaveLength(LEVEL_ONE_TOPICS.reduce((sum, topic) => sum + topic.prerequisites.length, 0));
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(1);
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(1);
    }
  });

  it('derives node states for the hero learner', () => {
    const decision = decideNextTopic({
      mastery: HERO_LEARNER.mastery,
      activeMisconceptionTopicIds: HERO_LEARNER.misconceptionTopicIds,
    });
    const states = nodeStates(HERO_LEARNER.mastery, decision);
    expect(states[EQUATION_TOPIC_ID]).toBe('mastered');
    expect(states[DEBIT_CREDIT_TOPIC_ID]).toBe('recovery');
    expect(states['l1-t10-chart-of-accounts']).toBe('available');
    expect(states[JOURNAL_TOPIC_ID]).toBe('locked');
  });
});

describe('product demo story', () => {
  it('has seven steps and reproducible frames', () => {
    expect(STORY_STEPS).toHaveLength(7);
    expect(frameAt(3)).toEqual(frameAt(3));
  });

  it('changes the session, mode and difficulty in order', () => {
    expect(frameAt(0).experience.values.sessionMinutes).toBe(5);
    expect(frameAt(2).experience.values.teachingMode).toBe('explain');
    expect(frameAt(3).experience.values.teachingMode).toBe('socratic');
    expect(frameAt(3).experience.values.difficulty).toBe(3);
    expect(frameAt(4).experience.values.difficulty).toBe(4);
  });

  it('switches the policy from progression to remediation to progression', () => {
    expect(frameAt(0).decision.rationaleKind).toBe('progression');
    expect(frameAt(1).decision.rationaleKind).toBe('remediation');
    expect(frameAt(5).decision.rationaleKind).toBe('progression');
    expect(frameAt(5).decision.topicId).toBe(JOURNAL_TOPIC_ID);
    expect(frameAt(5).rewardVisible).toBe(true);
    expect(frameAt(6).creatorVisible).toBe(true);
    expect(frameAt(4).rewardVisible).toBe(false);
  });

  it('puts the misconception review first only while one is active', () => {
    expect(frameAt(1).session[0]!.kind).toBe('misconception');
    expect(frameAt(5).session.some((step) => step.kind === 'misconception')).toBe(false);
  });
});

describe('locale resolution', () => {
  it('prefers query, then cookie, then Accept-Language, then Indonesian', () => {
    expect(resolveLocale({ query: 'en', cookie: 'id' })).toBe('en');
    expect(resolveLocale({ query: ['en'], cookie: 'id' })).toBe('en');
    expect(resolveLocale({ query: 'fr', cookie: 'en' })).toBe('en');
    expect(resolveLocale({ acceptLanguage: 'en-US,en;q=0.9,id;q=0.5' })).toBe('en');
    expect(resolveLocale({ acceptLanguage: 'id-ID,id;q=0.9' })).toBe('id');
    expect(resolveLocale({ acceptLanguage: 'fr-FR' })).toBe('id');
    expect(resolveLocale({})).toBe('id');
  });
});
