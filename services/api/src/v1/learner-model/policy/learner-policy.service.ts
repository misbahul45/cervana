import { Injectable } from '@nestjs/common';
import {
  ConceptProgress,
  NextConceptDecision,
  NextConceptInput,
  PersonalPolicySnapshot,
  PolicyDecisionInput,
  STRATEGY_HINT_BUDGET,
  ScaffoldLevel,
  StrategyReasonCode,
  TeachingDecision,
  TeachingStrategy,
} from './policy.types';

export const PASS_SCORE = 0.7;
export const PASS_EVIDENCE = 3;
export const STABLE_EVIDENCE = 3;
const PERSONAL_POLICY_MIN_ATTEMPTS = 5;
const PREFERENCE_MIN_ATTEMPTS = 3;
const PREFERENCE_MIN_SUCCESS_RATE = 0.7;
const REVIEW_AFTER_DAYS = 7;
const UNSTABLE_MAX_ATTEMPTS = 4;

const BASE_MAX_ATTEMPTS: Record<TeachingStrategy, number> = {
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

interface Selection {
  strategy: TeachingStrategy;
  reasonCodes: StrategyReasonCode[];
}

const masteryBand = (mastery: number, lowBelow: number, midBelow: number): StrategyReasonCode =>
  mastery < lowBelow ? 'LOW_MASTERY' : mastery < midBelow ? 'MID_MASTERY' : 'HIGH_MASTERY';

const isPassed = (progress: ConceptProgress | undefined): boolean =>
  progress !== undefined && progress.score >= PASS_SCORE && progress.evidenceCount >= PASS_EVIDENCE;

@Injectable()
export class LearnerPolicyService {
  teachingStrategy(input: PolicyDecisionInput): TeachingDecision {
    const { strategy, reasonCodes } = this.select(input);
    const stable = input.learner.evidenceCount >= STABLE_EVIDENCE;
    const difficultyTarget = this.zpdDifficulty(input.learner.mastery, input.concept.difficulty);

    return {
      strategy,
      difficultyTarget,
      hintLevel: STRATEGY_HINT_BUDGET[strategy],
      scaffoldLevel: this.scaffold(input.learner.openMisconceptionCount),
      maxAttempts: stable ? BASE_MAX_ATTEMPTS[strategy] : UNSTABLE_MAX_ATTEMPTS,
      reasonCodes: stable ? reasonCodes : [...reasonCodes, 'INSUFFICIENT_EVIDENCE'],
      invariants: {
        difficultyInZoneOfProximalDevelopment: Math.abs(difficultyTarget - input.learner.recentItemDifficulty) <= 0.25,
        masteryStable: stable,
        policyEvidenceSufficient: this.hasPolicyEvidence(input.policy),
      },
    };
  }

  nextConcept({ graph, progress }: NextConceptInput): NextConceptDecision {
    if (graph.order.length === 0) return { conceptId: null, level: null, reasonCodes: ['NO_CONCEPTS'] };

    const started = graph.order.some((id) => (progress.get(id)?.evidenceCount ?? 0) > 0);
    const unpassed = graph.order.filter((id) => !isPassed(progress.get(id)));
    if (unpassed.length === 0) return { conceptId: null, level: null, reasonCodes: ['ALL_CONCEPTS_PASSED'] };

    const ready = unpassed.find((id) => graph.prerequisitesOf(id).every((requiredId) => isPassed(progress.get(requiredId))));
    if (ready === undefined) {
      const first = unpassed[0];
      return { conceptId: first, level: graph.levelOf(first), reasonCodes: [started ? 'UNREACHABLE_PREREQUISITES' : 'NO_EVIDENCE_START'] };
    }

    if (!started) return { conceptId: ready, level: graph.levelOf(ready), reasonCodes: ['NO_EVIDENCE_START'] };
    const attempted = (progress.get(ready)?.evidenceCount ?? 0) > 0;
    return { conceptId: ready, level: graph.levelOf(ready), reasonCodes: [attempted ? 'CONTINUE_PRACTICE' : 'PREREQUISITES_MET'] };
  }

  private select({ intent, learner, concept, policy }: PolicyDecisionInput): Selection {
    if (learner.openMisconceptionCount >= 2) return { strategy: 'REMEDIATE', reasonCodes: ['OPEN_MISCONCEPTIONS'] };
    if (intent === 'TRANSFER' && concept.isTransferEligible) return { strategy: 'TRANSFER', reasonCodes: ['INTENT_TRANSFER'] };
    if (intent === 'CHALLENGE') return { strategy: 'CHALLENGE', reasonCodes: ['INTENT_CHALLENGE'] };

    if (intent === 'PRACTICE' && learner.evidenceCount >= STABLE_EVIDENCE) {
      const preferred = this.mostEffectiveStrategy(policy);
      if (preferred) return { strategy: preferred, reasonCodes: ['PERSONAL_STRATEGY_PREFERRED'] };
    }

    if (intent === 'DOUBT') {
      const band = masteryBand(learner.mastery, 0.3, 0.6);
      const strategy = band === 'LOW_MASTERY' ? 'WORKED_EXAMPLE' : band === 'MID_MASTERY' ? 'GUIDED_EXAMPLE' : 'SOCRATIC';
      return { strategy, reasonCodes: [band] };
    }

    if (intent === 'NEW_LEARNING') {
      if (!concept.prerequisiteMasteryMet) return { strategy: 'REMEDIATE', reasonCodes: ['PREREQUISITE_NOT_MET'] };
      const band = masteryBand(learner.mastery, 0.4, 0.7);
      const strategy = band === 'LOW_MASTERY' ? 'WORKED_EXAMPLE' : band === 'MID_MASTERY' ? 'GUIDED_EXAMPLE' : 'EXPLAIN';
      return { strategy, reasonCodes: [band] };
    }

    if (learner.daysSinceLastReview > REVIEW_AFTER_DAYS) return { strategy: 'REVIEW', reasonCodes: ['REVIEW_DUE'] };
    return { strategy: 'PRACTICE', reasonCodes: ['INTENT_PRACTICE'] };
  }

  private zpdDifficulty(mastery: number, conceptDifficulty: number): number {
    const lower = Math.max(0, mastery - 0.1);
    const upper = Math.min(1, mastery + 0.2);
    const adjusted = (lower + upper) / 2 + (conceptDifficulty - 0.5) * 0.1;
    return Math.max(0.1, Math.min(0.95, adjusted));
  }

  private scaffold(openMisconceptions: number): ScaffoldLevel {
    if (openMisconceptions >= 2) return 'HIGH';
    if (openMisconceptions === 1) return 'MEDIUM';
    return 'MINIMAL';
  }

  private mostEffectiveStrategy(policy: PersonalPolicySnapshot): TeachingStrategy | null {
    const ranked = (Object.entries(policy.strategyEvidence) as Array<[TeachingStrategy, { successes: number; attempts: number }]>)
      .filter(([, stats]) => stats.attempts >= PREFERENCE_MIN_ATTEMPTS)
      .map(([strategy, stats]) => ({ strategy, rate: stats.successes / stats.attempts }))
      .filter((entry) => entry.rate >= PREFERENCE_MIN_SUCCESS_RATE)
      .sort((a, b) => b.rate - a.rate);
    return ranked.length > 0 ? ranked[0].strategy : null;
  }

  private hasPolicyEvidence(policy: PersonalPolicySnapshot): boolean {
    const total = Object.values(policy.strategyEvidence).reduce((sum, stats) => sum + stats.attempts, 0);
    return total >= PERSONAL_POLICY_MIN_ATTEMPTS;
  }
}
