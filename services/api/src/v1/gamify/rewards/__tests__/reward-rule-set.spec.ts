import {
  DEFAULT_REWARD_RULE_ROWS,
  DEFAULT_RULE_SET,
  RewardRuleRow,
  buildRuleSet,
  evaluateAssessment,
  masteryProgressPoints,
  nodeMasteredGrant,
  streakBonus,
} from '../reward-rules';

const row = (overrides: Partial<RewardRuleRow> & Pick<RewardRuleRow, 'code' | 'version'>): RewardRuleRow => ({
  eventType: 'ASSESSMENT_COMPLETED',
  rewardKind: 'XP',
  amount: 50,
  dailyCap: null,
  params: null,
  active: true,
  ...overrides,
});

const assessment = (score: number, evidenceCount: number, paid = 0) => ({
  userId: 'u1',
  conceptId: 'c1',
  eventId: 'e1',
  after: { score, evidenceCount },
  alreadyPaidProgress: paid,
});

describe('default rows', () => {
  it('are the four rules of the catalog at version 1, with their values as data', () => {
    const byCode = Object.fromEntries(DEFAULT_REWARD_RULE_ROWS.map((r) => [r.code, r]));

    expect(Object.keys(byCode).sort()).toEqual(['CONCEPT_PASSED', 'MASTERY_PROGRESS', 'PATH_NODE_MASTERED', 'STREAK_BONUS_7']);
    expect(byCode.MASTERY_PROGRESS).toMatchObject({ version: 1, rewardKind: 'XP', amount: 50, params: { perUnit: 100, baseline: 0.5 } });
    expect(byCode.CONCEPT_PASSED).toMatchObject({ version: 1, rewardKind: 'XP', amount: 50 });
    expect(byCode.STREAK_BONUS_7).toMatchObject({ version: 1, rewardKind: 'XP', amount: 50, params: { every: 7 } });
    expect(byCode.PATH_NODE_MASTERED).toMatchObject({ version: 1, rewardKind: 'STAR', amount: 1 });
  });

  it('build the default rule set, which grants exactly what the constants granted', () => {
    expect(buildRuleSet([])).toEqual(DEFAULT_RULE_SET);
    expect(buildRuleSet(DEFAULT_REWARD_RULE_ROWS)).toEqual(DEFAULT_RULE_SET);
  });
});

describe('buildRuleSet', () => {
  it('uses the highest active version of a code', () => {
    const set = buildRuleSet([
      row({ code: 'CONCEPT_PASSED', version: 1, amount: 50 }),
      row({ code: 'CONCEPT_PASSED', version: 2, amount: 80 }),
      row({ code: 'CONCEPT_PASSED', version: 3, amount: 99, active: false }),
    ]);

    expect(set.conceptPassed).toEqual({ version: 2, points: 80 });
  });

  it('turns a rule off when every row of its code is inactive, and does not fall back to the default', () => {
    const set = buildRuleSet([row({ code: 'CONCEPT_PASSED', version: 1, active: false })]);

    expect(set.conceptPassed).toBeNull();
    expect(set.masteryProgress).toEqual(DEFAULT_RULE_SET.masteryProgress);
  });

  it('reads formula parameters from the row and rejects unusable ones by falling back to the defaults of that rule', () => {
    const tuned = buildRuleSet([row({ code: 'MASTERY_PROGRESS', version: 2, amount: 30, params: { perUnit: 200, baseline: 0.4 } })]);
    expect(tuned.masteryProgress).toEqual({ version: 2, cap: 30, perUnit: 200, baseline: 0.4 });

    for (const params of [null, {}, { perUnit: 'x', baseline: 0.5 }, { perUnit: -1, baseline: 0.5 }, { perUnit: 100, baseline: 2 }]) {
      const set = buildRuleSet([row({ code: 'MASTERY_PROGRESS', version: 2, amount: 30, params })]);
      expect(set.masteryProgress).toEqual({ version: 2, cap: 30, perUnit: 100, baseline: 0.5 });
    }
  });

  it('reads the streak bonus interval and the star amount', () => {
    const set = buildRuleSet([
      row({ code: 'STREAK_BONUS_7', version: 2, amount: 70, params: { every: 14 } }),
      row({ code: 'PATH_NODE_MASTERED', version: 2, rewardKind: 'STAR', amount: 2 }),
    ]);

    expect(set.streakBonus).toEqual({ version: 2, points: 70, every: 14 });
    expect(set.nodeMastered).toEqual({ version: 2, stars: 2 });
  });

  it('ignores a row of an unknown code', () => {
    expect(buildRuleSet([row({ code: 'SOMETHING_ELSE', version: 1 })])).toEqual(DEFAULT_RULE_SET);
  });
});

describe('evaluateAssessment with a rule set', () => {
  it('pays with the version and the values of the set, and puts the version in the idempotency key', () => {
    const rules = buildRuleSet([
      row({ code: 'MASTERY_PROGRESS', version: 2, amount: 40, params: { perUnit: 200, baseline: 0.5 } }),
      row({ code: 'CONCEPT_PASSED', version: 2, amount: 70 }),
    ]);

    const grants = evaluateAssessment(assessment(0.8, 3), rules);

    expect(grants).toEqual([
      expect.objectContaining({ ruleId: 'MASTERY_PROGRESS', ruleVersion: 2, points: 40, idempotencyKey: 'reward:MASTERY_PROGRESS:v2:e1' }),
      expect.objectContaining({ ruleId: 'CONCEPT_PASSED', ruleVersion: 2, points: 70, idempotencyKey: 'reward:CONCEPT_PASSED:v2:u1:c1' }),
    ]);
  });

  it('pays nothing for a rule that is off', () => {
    const rules = buildRuleSet([
      row({ code: 'MASTERY_PROGRESS', version: 1, active: false }),
      row({ code: 'CONCEPT_PASSED', version: 1, active: false }),
    ]);

    expect(evaluateAssessment(assessment(0.9, 5), rules)).toEqual([]);
  });

  it('is unchanged without a rule set', () => {
    expect(evaluateAssessment(assessment(0.622, 1))).toEqual(evaluateAssessment(assessment(0.622, 1), DEFAULT_RULE_SET));
    expect(masteryProgressPoints(0.622, 0)).toBe(12);
  });
});

describe('streakBonus with a rule set', () => {
  it('pays on the interval of the set and not at all when the rule is off', () => {
    const every14 = buildRuleSet([row({ code: 'STREAK_BONUS_7', version: 2, amount: 70, params: { every: 14 } })]);

    expect(streakBonus('u1', 7, new Date('2026-10-10T00:00:00Z'), every14)).toBeNull();
    expect(streakBonus('u1', 14, new Date('2026-10-10T00:00:00Z'), every14)).toMatchObject({ points: 70, ruleVersion: 2 });
    expect(streakBonus('u1', 7, new Date('2026-10-10T00:00:00Z'), buildRuleSet([row({ code: 'STREAK_BONUS_7', version: 1, active: false })]))).toBeNull();
  });
});

describe('nodeMasteredGrant', () => {
  it('is one star, once per learner and node, as a STAR entry', () => {
    expect(nodeMasteredGrant('u1', 'sub-1', DEFAULT_RULE_SET)).toEqual({
      kind: 'STAR',
      ruleId: 'PATH_NODE_MASTERED',
      ruleVersion: 1,
      points: 1,
      idempotencyKey: 'reward:PATH_NODE_MASTERED:v1:u1:sub-1',
      sourceType: 'NODE',
      sourceId: 'sub-1',
      subTopicId: 'sub-1',
    });
  });

  it('is null when the rule is off or pays nothing', () => {
    expect(nodeMasteredGrant('u1', 'sub-1', buildRuleSet([row({ code: 'PATH_NODE_MASTERED', version: 1, rewardKind: 'STAR', active: false })]))).toBeNull();
    expect(nodeMasteredGrant('u1', 'sub-1', buildRuleSet([row({ code: 'PATH_NODE_MASTERED', version: 2, rewardKind: 'STAR', amount: 0 })]))).toBeNull();
  });
});
