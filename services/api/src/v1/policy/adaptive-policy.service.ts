import { Injectable } from '@nestjs/common';

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

export interface LearnerSnapshot {
  mastery: number;
  confidence: number;
  evidenceCount: number;
  openMisconceptionCount: number;
  daysSinceLastReview: number;
  consecutiveCorrect: number;
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
  intent: 'NEW_LEARNING' | 'PRACTICE' | 'DOUBT' | 'CHALLENGE' | 'TRANSFER';
  learner: LearnerSnapshot;
  concept: ConceptSnapshot;
  policy: PersonalPolicySnapshot;
}

export interface AdaptiveTutoringStrategy {
  strategy: TeachingStrategy;
  difficultyTarget: number;
  hintLevel: 0 | 1 | 2 | 3;
  scaffoldLevel: 'MINIMAL' | 'MEDIUM' | 'HIGH';
  maxAttempts: number;
  rationale: string;
  invariants: {
    difficultyInZoneOfProximalDevelopment: boolean;
    masteryStable: boolean;
    policyEvidenceSufficient: boolean;
  };
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

@Injectable()
export class AdaptivePolicyService {
  decide(input: PolicyDecisionInput): AdaptiveTutoringStrategy {
    const zpd = this.computeZpdDifficulty(input.learner.mastery, input.concept.difficulty);
    const scaffold = this.computeScaffoldLevel(input.learner.openMisconceptionCount);
    const strategy = this.selectStrategy(input);
    const hintLevel = STRATEGY_HINT_BUDGET[strategy];
    const maxAttempts = this.computeMaxAttempts(strategy, input.learner.confidence);
    const rationale = this.buildRationale(strategy, input, zpd, scaffold);
    const invariants = {
      difficultyInZoneOfProximalDevelopment:
        Math.abs(zpd - input.learner.recentItemDifficulty) <= 0.25,
      masteryStable: input.learner.evidenceCount >= 3,
      policyEvidenceSufficient: this.hasPolicyEvidence(input.policy),
    };

    return {
      strategy,
      difficultyTarget: zpd,
      hintLevel,
      scaffoldLevel: scaffold,
      maxAttempts,
      rationale,
      invariants,
    };
  }

  private selectStrategy(input: PolicyDecisionInput): TeachingStrategy {
    const { intent, learner, concept, policy } = input;

    if (learner.openMisconceptionCount >= 2) {
      return 'REMEDIATE';
    }

    if (intent === 'TRANSFER' && concept.isTransferEligible) {
      return 'TRANSFER';
    }

    if (intent === 'CHALLENGE') {
      return 'CHALLENGE';
    }

    if (intent === 'PRACTICE' && learner.confidence > 0.7) {
      const preferredReview = this.mostEffectiveReviewStrategy(policy);
      if (preferredReview) return preferredReview;
    }

    if (intent === 'DOUBT') {
      if (learner.mastery < 0.3) {
        return 'WORKED_EXAMPLE';
      }
      if (learner.mastery < 0.6) {
        return 'GUIDED_EXAMPLE';
      }
      return 'SOCRATIC';
    }

    if (intent === 'NEW_LEARNING') {
      if (!concept.prerequisiteMasteryMet) {
        return 'REMEDIATE';
      }
      if (learner.mastery < 0.4) {
        return 'WORKED_EXAMPLE';
      }
      if (learner.mastery < 0.7) {
        return 'GUIDED_EXAMPLE';
      }
      return 'EXPLAIN';
    }

    if (learner.daysSinceLastReview > 7) {
      return 'REVIEW';
    }

    return 'PRACTICE';
  }

  private computeZpdDifficulty(mastery: number, conceptDifficulty: number): number {
    const lower = Math.max(0, mastery - 0.1);
    const upper = Math.min(1, mastery + 0.2);
    const midpoint = (lower + upper) / 2;
    const adjusted = midpoint + (conceptDifficulty - 0.5) * 0.1;
    return Math.max(0.1, Math.min(0.95, adjusted));
  }

  private computeScaffoldLevel(openMisconceptions: number): 'MINIMAL' | 'MEDIUM' | 'HIGH' {
    if (openMisconceptions >= 2) return 'HIGH';
    if (openMisconceptions === 1) return 'MEDIUM';
    return 'MINIMAL';
  }

  private computeMaxAttempts(strategy: TeachingStrategy, confidence: number): number {
    const base: Record<TeachingStrategy, number> = {
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
    const cap = confidence < 0.3 ? 4 : base[strategy];
    return Math.max(1, cap);
  }

  private mostEffectiveReviewStrategy(policy: PersonalPolicySnapshot): TeachingStrategy | null {
    const ranked = (Object.entries(policy.strategyEvidence) as Array<[
      TeachingStrategy,
      { successes: number; attempts: number },
    ]>)
      .filter(([_, stats]) => stats.attempts >= 3)
      .map(([strategy, stats]) => ({
        strategy,
        rate: stats.successes / stats.attempts,
      }))
      .filter((entry) => entry.rate >= 0.7)
      .sort((a, b) => b.rate - a.rate);

    if (ranked.length === 0) return null;
    return ranked[0].strategy;
  }

  private hasPolicyEvidence(policy: PersonalPolicySnapshot): boolean {
    const total = Object.values(policy.strategyEvidence).reduce(
      (sum, stats) => sum + stats.attempts,
      0,
    );
    return total >= 5;
  }

  private buildRationale(
    strategy: TeachingStrategy,
    input: PolicyDecisionInput,
    zpd: number,
    scaffold: 'MINIMAL' | 'MEDIUM' | 'HIGH',
  ): string {
    const reasons: string[] = [];
    if (input.learner.openMisconceptionCount >= 2) {
      reasons.push('2+ open misconceptions -> REMEDIATE');
    }
    if (input.intent === 'DOUBT' && input.learner.mastery < 0.3) {
      reasons.push(`mastery=${input.learner.mastery} < 0.3 -> WORKED_EXAMPLE`);
    }
    if (input.intent === 'NEW_LEARNING' && !input.concept.prerequisiteMasteryMet) {
      reasons.push('prerequisites not met -> REMEDIATE');
    }
    if (reasons.length === 0) {
      reasons.push(`selected ${strategy} for intent=${input.intent} mastery=${input.learner.mastery}`);
    }
    reasons.push(`zpd=${zpd.toFixed(2)} scaffold=${scaffold}`);
    return reasons.join('; ');
  }
}
