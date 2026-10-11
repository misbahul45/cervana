import { LEVEL_ONE_TOPICS, type CatalogTopic } from './catalog';

export const MASTERY_THRESHOLD = 0.7;
export const REMEDIATION_THRESHOLD = 0.5;

export type RationaleKind = 'no_exploration' | 'remediation' | 'progression';

export interface NextTopicInput {
  readonly mastery: Readonly<Record<string, number>>;
  readonly activeMisconceptionTopicIds: readonly string[];
  readonly topics?: readonly CatalogTopic[];
}

export interface NextTopicDecision {
  readonly topicId: string;
  readonly level: number;
  readonly rationaleKind: RationaleKind;
  readonly rationale: Readonly<Record<string, unknown>>;
}

export function decideNextTopic(input: NextTopicInput): NextTopicDecision {
  const topics = input.topics ?? LEVEL_ONE_TOPICS;
  const recorded = Object.keys(input.mastery);
  const firstTopicId = topics[0]!.id;

  if (recorded.length === 0) {
    return {
      topicId: firstTopicId,
      level: 1,
      rationaleKind: 'no_exploration',
      rationale: { reason: 'no_mastery_recorded' },
    };
  }

  const masteryOf = (topicId: string) => input.mastery[topicId] ?? 0;

  const recoveryTopicId = input.activeMisconceptionTopicIds.find(
    (topicId) => masteryOf(topicId) < REMEDIATION_THRESHOLD,
  );
  if (recoveryTopicId) {
    return {
      topicId: recoveryTopicId,
      level: 1,
      rationaleKind: 'remediation',
      rationale: { patternCode: recoveryTopicId, topicId: recoveryTopicId },
    };
  }

  for (const topic of topics) {
    const prerequisitesMet = topic.prerequisites.every(
      (prerequisiteId) => masteryOf(prerequisiteId) >= MASTERY_THRESHOLD,
    );
    const passed = masteryOf(topic.id) >= MASTERY_THRESHOLD;
    if (prerequisitesMet && !passed) {
      return {
        topicId: topic.id,
        level: 1,
        rationaleKind: 'progression',
        rationale: { prerequisitesMet: topic.prerequisites },
      };
    }
  }

  return {
    topicId: firstTopicId,
    level: 1,
    rationaleKind: 'no_exploration',
    rationale: { reason: 'all_topics_mastered' },
  };
}

export type TeachingStrategy =
  | 'EXPLAIN'
  | 'ASK'
  | 'HINT'
  | 'WORKED_EXAMPLE'
  | 'GUIDED_EXAMPLE'
  | 'SOCRATIC'
  | 'COUNTEREXAMPLE'
  | 'PRACTICE'
  | 'REMEDIATE'
  | 'REVIEW'
  | 'CHALLENGE'
  | 'TRANSFER';

export type TutoringIntent = 'NEW_LEARNING' | 'PRACTICE' | 'DOUBT' | 'CHALLENGE' | 'TRANSFER';

export type ScaffoldLevel = 'MINIMAL' | 'MEDIUM' | 'HIGH';

export interface LearnerSnapshot {
  readonly mastery: number;
  readonly confidence: number;
  readonly evidenceCount: number;
  readonly openMisconceptionCount: number;
  readonly daysSinceLastReview: number;
  readonly consecutiveCorrect: number;
  readonly recentItemDifficulty: number;
}

export interface ConceptSnapshot {
  readonly prerequisiteMasteryMet: boolean;
  readonly isTransferEligible: boolean;
  readonly difficulty: number;
}

export interface StrategyEvidence {
  readonly successes: number;
  readonly attempts: number;
}

export interface PersonalPolicySnapshot {
  readonly strategyEvidence: Readonly<Record<TeachingStrategy, StrategyEvidence>>;
}

export interface StrategyInput {
  readonly intent: TutoringIntent;
  readonly learner: LearnerSnapshot;
  readonly concept: ConceptSnapshot;
  readonly policy: PersonalPolicySnapshot;
}

export interface StrategyDecision {
  readonly strategy: TeachingStrategy;
  readonly difficultyTarget: number;
  readonly hintLevel: 0 | 1 | 2 | 3;
  readonly scaffoldLevel: ScaffoldLevel;
  readonly maxAttempts: number;
  readonly rationale: string;
}

export const TEACHING_STRATEGIES: readonly TeachingStrategy[] = [
  'EXPLAIN',
  'ASK',
  'HINT',
  'WORKED_EXAMPLE',
  'GUIDED_EXAMPLE',
  'SOCRATIC',
  'COUNTEREXAMPLE',
  'PRACTICE',
  'REMEDIATE',
  'REVIEW',
  'CHALLENGE',
  'TRANSFER',
];

const HINT_BUDGET: Readonly<Record<TeachingStrategy, 0 | 1 | 2 | 3>> = {
  EXPLAIN: 1,
  ASK: 2,
  HINT: 3,
  WORKED_EXAMPLE: 0,
  GUIDED_EXAMPLE: 1,
  SOCRATIC: 2,
  COUNTEREXAMPLE: 2,
  PRACTICE: 2,
  REMEDIATE: 3,
  REVIEW: 1,
  CHALLENGE: 1,
  TRANSFER: 2,
};

const BASE_ATTEMPTS: Readonly<Record<TeachingStrategy, number>> = {
  EXPLAIN: 3,
  ASK: 3,
  HINT: 3,
  WORKED_EXAMPLE: 1,
  GUIDED_EXAMPLE: 2,
  SOCRATIC: 3,
  COUNTEREXAMPLE: 2,
  PRACTICE: 5,
  REMEDIATE: 4,
  REVIEW: 3,
  CHALLENGE: 5,
  TRANSFER: 3,
};

export function emptyPolicySnapshot(): PersonalPolicySnapshot {
  const evidence = {} as Record<TeachingStrategy, StrategyEvidence>;
  for (const strategy of TEACHING_STRATEGIES) {
    evidence[strategy] = { successes: 0, attempts: 0 };
  }
  return { strategyEvidence: evidence };
}

function mostEffectiveStrategy(policy: PersonalPolicySnapshot): TeachingStrategy | null {
  const ranked = TEACHING_STRATEGIES.map((strategy) => ({
    strategy,
    attempts: policy.strategyEvidence[strategy].attempts,
    rate: policy.strategyEvidence[strategy].successes / Math.max(1, policy.strategyEvidence[strategy].attempts),
  }))
    .filter((entry) => entry.attempts >= 3 && entry.rate >= 0.7)
    .sort((a, b) => b.rate - a.rate);
  return ranked[0]?.strategy ?? null;
}

function selectStrategy(input: StrategyInput): TeachingStrategy {
  const { intent, learner, concept, policy } = input;

  if (learner.openMisconceptionCount >= 2) return 'REMEDIATE';
  if (intent === 'TRANSFER' && concept.isTransferEligible) return 'TRANSFER';
  if (intent === 'CHALLENGE') return 'CHALLENGE';

  if (intent === 'PRACTICE' && learner.confidence > 0.7) {
    const preferred = mostEffectiveStrategy(policy);
    if (preferred) return preferred;
  }

  if (intent === 'DOUBT') {
    if (learner.mastery < 0.3) return 'WORKED_EXAMPLE';
    if (learner.mastery < 0.6) return 'GUIDED_EXAMPLE';
    return 'SOCRATIC';
  }

  if (intent === 'NEW_LEARNING') {
    if (!concept.prerequisiteMasteryMet) return 'REMEDIATE';
    if (learner.mastery < 0.4) return 'WORKED_EXAMPLE';
    if (learner.mastery < 0.7) return 'GUIDED_EXAMPLE';
    return 'EXPLAIN';
  }

  if (learner.daysSinceLastReview > 7) return 'REVIEW';
  return 'PRACTICE';
}

function zoneOfProximalDifficulty(mastery: number, conceptDifficulty: number): number {
  const lower = Math.max(0, mastery - 0.1);
  const upper = Math.min(1, mastery + 0.2);
  const midpoint = (lower + upper) / 2;
  const adjusted = midpoint + (conceptDifficulty - 0.5) * 0.1;
  return Math.max(0.1, Math.min(0.95, adjusted));
}

function scaffoldFor(openMisconceptions: number): ScaffoldLevel {
  if (openMisconceptions >= 2) return 'HIGH';
  if (openMisconceptions === 1) return 'MEDIUM';
  return 'MINIMAL';
}

export function decideStrategy(input: StrategyInput): StrategyDecision {
  const strategy = selectStrategy(input);
  const difficultyTarget = zoneOfProximalDifficulty(input.learner.mastery, input.concept.difficulty);
  const scaffoldLevel = scaffoldFor(input.learner.openMisconceptionCount);
  const maxAttempts = Math.max(1, input.learner.confidence < 0.3 ? 4 : BASE_ATTEMPTS[strategy]);
  return {
    strategy,
    difficultyTarget,
    hintLevel: HINT_BUDGET[strategy],
    scaffoldLevel,
    maxAttempts,
    rationale: `intent=${input.intent} mastery=${input.learner.mastery} zpd=${difficultyTarget.toFixed(2)} scaffold=${scaffoldLevel}`,
  };
}

export function strategyForPercent(input: {
  intent: TutoringIntent;
  masteryPercent: number;
  confidencePercent: number;
  openMisconceptionCount: number;
  daysSinceLastReview: number;
  prerequisiteMasteryMet: boolean;
}): StrategyDecision {
  const mastery = input.masteryPercent / 100;
  return decideStrategy({
    intent: input.intent,
    learner: {
      mastery,
      confidence: input.confidencePercent / 100,
      evidenceCount: 5,
      openMisconceptionCount: input.openMisconceptionCount,
      daysSinceLastReview: input.daysSinceLastReview,
      consecutiveCorrect: 0,
      recentItemDifficulty: mastery,
    },
    concept: {
      prerequisiteMasteryMet: input.prerequisiteMasteryMet,
      isTransferEligible: true,
      difficulty: 0.5,
    },
    policy: emptyPolicySnapshot(),
  });
}
