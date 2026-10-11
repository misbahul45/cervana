import { ConceptGraph } from '../concepts/concept-graph';

export const TEACHING_STRATEGIES = [
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
] as const;

export type TeachingStrategy = (typeof TEACHING_STRATEGIES)[number];

export type PolicyIntent = 'NEW_LEARNING' | 'PRACTICE' | 'DOUBT' | 'CHALLENGE' | 'TRANSFER';

export type StrategyReasonCode =
  | 'OPEN_MISCONCEPTIONS'
  | 'PREREQUISITE_NOT_MET'
  | 'LOW_MASTERY'
  | 'MID_MASTERY'
  | 'HIGH_MASTERY'
  | 'INTENT_CHALLENGE'
  | 'INTENT_TRANSFER'
  | 'INTENT_PRACTICE'
  | 'REVIEW_DUE'
  | 'PERSONAL_STRATEGY_PREFERRED'
  | 'INSUFFICIENT_EVIDENCE';

export type NextConceptReasonCode =
  | 'NO_CONCEPTS'
  | 'NO_EVIDENCE_START'
  | 'PREREQUISITES_MET'
  | 'CONTINUE_PRACTICE'
  | 'UNREACHABLE_PREREQUISITES'
  | 'ALL_CONCEPTS_PASSED';

export interface LearnerSnapshot {
  mastery: number;
  evidenceCount: number;
  openMisconceptionCount: number;
  daysSinceLastReview: number;
  recentItemDifficulty: number;
}

export interface ConceptSnapshot {
  prerequisiteMasteryMet: boolean;
  isTransferEligible: boolean;
  difficulty: number;
}

export interface PersonalPolicySnapshot {
  preferredStrategy?: TeachingStrategy;
  strategyEvidence: Record<TeachingStrategy, { successes: number; attempts: number }>;
}

export interface PolicyDecisionInput {
  intent: PolicyIntent;
  learner: LearnerSnapshot;
  concept: ConceptSnapshot;
  policy: PersonalPolicySnapshot;
}

export type ScaffoldLevel = 'MINIMAL' | 'MEDIUM' | 'HIGH';

export interface TeachingDecision {
  strategy: TeachingStrategy;
  difficultyTarget: number;
  hintLevel: 0 | 1 | 2 | 3;
  scaffoldLevel: ScaffoldLevel;
  maxAttempts: number;
  reasonCodes: StrategyReasonCode[];
  invariants: {
    difficultyInZoneOfProximalDevelopment: boolean;
    masteryStable: boolean;
    policyEvidenceSufficient: boolean;
  };
}

export interface ConceptProgress {
  score: number;
  evidenceCount: number;
}

export interface NextConceptInput {
  graph: ConceptGraph;
  progress: Map<string, ConceptProgress>;
}

export interface NextConceptDecision {
  conceptId: string | null;
  level: number | null;
  reasonCodes: NextConceptReasonCode[];
}

export const STRATEGY_HINT_BUDGET: Readonly<Record<TeachingStrategy, 0 | 1 | 2 | 3>> = {
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
