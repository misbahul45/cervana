import { ConceptState } from '@/v1/learner-model/mastery/mastery-v1';
import { PASS_EVIDENCE, PASS_SCORE } from '@/v1/learner-model/policy/learner-policy.service';

export const REWARD_RULES = {
  MASTERY_PROGRESS: { id: 'MASTERY_PROGRESS', version: 1 },
  CONCEPT_PASSED: { id: 'CONCEPT_PASSED', version: 1 },
  STREAK_BONUS_7: { id: 'STREAK_BONUS_7', version: 1 },
  PATH_NODE_MASTERED: { id: 'PATH_NODE_MASTERED', version: 1 },
} as const;

export type RewardKindValue = 'XP' | 'STAR';

export interface RewardRuleRow {
  code: string;
  version: number;
  eventType: string;
  rewardKind: RewardKindValue;
  amount: number;
  dailyCap: number | null;
  params: unknown;
  active: boolean;
}

export interface MasteryProgressRule {
  version: number;
  cap: number;
  perUnit: number;
  baseline: number;
}

export interface ConceptPassedRule {
  version: number;
  points: number;
}

export interface StreakBonusRule {
  version: number;
  points: number;
  every: number;
}

export interface NodeMasteredRule {
  version: number;
  stars: number;
}

export interface RewardRuleSet {
  masteryProgress: MasteryProgressRule | null;
  conceptPassed: ConceptPassedRule | null;
  streakBonus: StreakBonusRule | null;
  nodeMastered: NodeMasteredRule | null;
}

const DEFAULT_PER_UNIT = 100;
const DEFAULT_BASELINE = 0.5;
const DEFAULT_PROGRESS_CAP = 50;
const DEFAULT_PASS_POINTS = 50;
const DEFAULT_STREAK_POINTS = 50;
const DEFAULT_STREAK_EVERY = 7;
const DEFAULT_NODE_STARS = 1;

export const DEFAULT_REWARD_RULE_ROWS: ReadonlyArray<RewardRuleRow> = [
  {
    code: REWARD_RULES.MASTERY_PROGRESS.id,
    version: REWARD_RULES.MASTERY_PROGRESS.version,
    eventType: 'ASSESSMENT_COMPLETED',
    rewardKind: 'XP',
    amount: DEFAULT_PROGRESS_CAP,
    dailyCap: null,
    params: { perUnit: DEFAULT_PER_UNIT, baseline: DEFAULT_BASELINE },
    active: true,
  },
  {
    code: REWARD_RULES.CONCEPT_PASSED.id,
    version: REWARD_RULES.CONCEPT_PASSED.version,
    eventType: 'ASSESSMENT_COMPLETED',
    rewardKind: 'XP',
    amount: DEFAULT_PASS_POINTS,
    dailyCap: null,
    params: null,
    active: true,
  },
  {
    code: REWARD_RULES.STREAK_BONUS_7.id,
    version: REWARD_RULES.STREAK_BONUS_7.version,
    eventType: 'STREAK_DAY_QUALIFIED',
    rewardKind: 'XP',
    amount: DEFAULT_STREAK_POINTS,
    dailyCap: null,
    params: { every: DEFAULT_STREAK_EVERY },
    active: true,
  },
  {
    code: REWARD_RULES.PATH_NODE_MASTERED.id,
    version: REWARD_RULES.PATH_NODE_MASTERED.version,
    eventType: 'NODE_MASTERED',
    rewardKind: 'STAR',
    amount: DEFAULT_NODE_STARS,
    dailyCap: null,
    params: null,
    active: true,
  },
];

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

const positiveNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

const fraction = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1 ? value : fallback;

const positiveInteger = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : fallback;

const pick = (rows: ReadonlyArray<RewardRuleRow>, code: string): { present: boolean; row: RewardRuleRow | null } => {
  const all = rows.filter((r) => r.code === code);
  const active = all.filter((r) => r.active).sort((a, b) => b.version - a.version);
  return { present: all.length > 0, row: active[0] ?? null };
};

export const buildRuleSet = (rows: ReadonlyArray<RewardRuleRow>): RewardRuleSet => {
  const defaults = (code: string) => DEFAULT_REWARD_RULE_ROWS.find((r) => r.code === code) as RewardRuleRow;
  const resolve = (code: string): RewardRuleRow | null => {
    const found = pick(rows, code);
    if (found.present) return found.row;
    return defaults(code);
  };

  const progress = resolve(REWARD_RULES.MASTERY_PROGRESS.id);
  const passed = resolve(REWARD_RULES.CONCEPT_PASSED.id);
  const streak = resolve(REWARD_RULES.STREAK_BONUS_7.id);
  const node = resolve(REWARD_RULES.PATH_NODE_MASTERED.id);

  return {
    masteryProgress: progress
      ? {
          version: progress.version,
          cap: progress.amount,
          perUnit: positiveNumber(asRecord(progress.params).perUnit, DEFAULT_PER_UNIT),
          baseline: fraction(asRecord(progress.params).baseline, DEFAULT_BASELINE),
        }
      : null,
    conceptPassed: passed ? { version: passed.version, points: passed.amount } : null,
    streakBonus: streak
      ? { version: streak.version, points: streak.amount, every: positiveInteger(asRecord(streak.params).every, DEFAULT_STREAK_EVERY) }
      : null,
    nodeMastered: node ? { version: node.version, stars: node.amount } : null,
  };
};

export const DEFAULT_RULE_SET: RewardRuleSet = buildRuleSet([]);

export interface RewardGrant {
  kind?: RewardKindValue;
  ruleId: string;
  ruleVersion: number;
  points: number;
  idempotencyKey: string;
  sourceType: 'LEARNING_EVENT' | 'STREAK' | 'NODE';
  sourceId: string;
  conceptId?: string;
  subTopicId?: string;
}

export interface AssessmentRewardInput {
  userId: string;
  conceptId: string;
  eventId: string;
  after: Pick<ConceptState, 'score' | 'evidenceCount'>;
  alreadyPaidProgress: number;
}

export const masteryProgressKey = (eventId: string, version: number = REWARD_RULES.MASTERY_PROGRESS.version) =>
  `reward:${REWARD_RULES.MASTERY_PROGRESS.id}:v${version}:${eventId}`;

export const conceptPassedKey = (userId: string, conceptId: string, version: number = REWARD_RULES.CONCEPT_PASSED.version) =>
  `reward:${REWARD_RULES.CONCEPT_PASSED.id}:v${version}:${userId}:${conceptId}`;

export const masteryProgressPoints = (
  scoreAfter: number,
  alreadyPaid: number,
  rule: Pick<MasteryProgressRule, 'cap' | 'perUnit' | 'baseline'> = DEFAULT_RULE_SET.masteryProgress as MasteryProgressRule,
): number => {
  if (!Number.isFinite(scoreAfter) || !Number.isFinite(alreadyPaid)) return 0;
  const target = Math.min(rule.cap, Math.floor(rule.perUnit * (scoreAfter - rule.baseline)));
  return Math.max(0, target - Math.max(0, alreadyPaid));
};

const isPassed = (state: Pick<ConceptState, 'score' | 'evidenceCount'>) =>
  state.score >= PASS_SCORE && state.evidenceCount >= PASS_EVIDENCE;

export const evaluateAssessment = (input: AssessmentRewardInput, rules: RewardRuleSet = DEFAULT_RULE_SET): RewardGrant[] => {
  const grants: RewardGrant[] = [];
  const common = { sourceType: 'LEARNING_EVENT', sourceId: input.eventId, conceptId: input.conceptId } as const;

  if (rules.masteryProgress) {
    const progress = masteryProgressPoints(input.after.score, input.alreadyPaidProgress, rules.masteryProgress);
    if (progress > 0) {
      grants.push({
        ruleId: REWARD_RULES.MASTERY_PROGRESS.id,
        ruleVersion: rules.masteryProgress.version,
        points: progress,
        idempotencyKey: masteryProgressKey(input.eventId, rules.masteryProgress.version),
        ...common,
      });
    }
  }

  if (rules.conceptPassed && rules.conceptPassed.points > 0 && isPassed(input.after)) {
    grants.push({
      ruleId: REWARD_RULES.CONCEPT_PASSED.id,
      ruleVersion: rules.conceptPassed.version,
      points: rules.conceptPassed.points,
      idempotencyKey: conceptPassedKey(input.userId, input.conceptId, rules.conceptPassed.version),
      ...common,
    });
  }

  return grants;
};

export const streakBonus = (userId: string, streakCount: number, on: Date, rules: RewardRuleSet = DEFAULT_RULE_SET): RewardGrant | null => {
  const rule = rules.streakBonus;
  if (!rule || rule.points <= 0 || streakCount < 1 || streakCount % rule.every !== 0) return null;
  const day = on.toISOString().slice(0, 10);
  return {
    ruleId: REWARD_RULES.STREAK_BONUS_7.id,
    ruleVersion: rule.version,
    points: rule.points,
    idempotencyKey: `reward:${REWARD_RULES.STREAK_BONUS_7.id}:v${rule.version}:${userId}:${day}`,
    sourceType: 'STREAK',
    sourceId: `${userId}:${day}`,
  };
};

export const nodeMasteredGrant = (userId: string, subTopicId: string, rules: RewardRuleSet = DEFAULT_RULE_SET): RewardGrant | null => {
  const rule = rules.nodeMastered;
  if (!rule || rule.stars <= 0) return null;
  return {
    kind: 'STAR',
    ruleId: REWARD_RULES.PATH_NODE_MASTERED.id,
    ruleVersion: rule.version,
    points: rule.stars,
    idempotencyKey: `reward:${REWARD_RULES.PATH_NODE_MASTERED.id}:v${rule.version}:${userId}:${subTopicId}`,
    sourceType: 'NODE',
    sourceId: subTopicId,
    subTopicId,
  };
};
