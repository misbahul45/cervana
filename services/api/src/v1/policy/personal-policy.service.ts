import { Injectable } from '@nestjs/common';
import type { TeachingStrategy } from '../policy/adaptive-policy.service';

export interface StrategyEvidence {
  strategy: TeachingStrategy;
  attempts: number;
  successes: number;
  averageScoreDelta: number;
  consecutiveFailures: number;
  lastUsedAt?: Date;
}

export interface PersonalPolicy {
  userId: string;
  strategyEvidence: Record<TeachingStrategy, StrategyEvidence>;
  preferredStrategy?: TeachingStrategy;
  confidence: number;
  version: number;
  updatedAt: Date;
}

export const POLICY_RULES = {
  MIN_EVIDENCE_BEFORE_PREFERENCE: 5,
  MIN_SUCCESS_RATE_FOR_PREFERENCE: 0.7,
  MIN_CONFIDENCE_TO_OVERRIDE_GLOBAL: 0.6,
  SMOOTHING_FACTOR: 0.1,
  DECAY_DAYS: 30,
} as const;

export interface PersonalPolicyUpdateInput {
  strategy: TeachingStrategy;
  scoreDelta: number;
  wasCorrect: boolean;
}

@Injectable()
export class PersonalPolicyService {
  buildEmpty(userId: string): PersonalPolicy {
    return {
      userId,
      strategyEvidence: this.emptyEvidence(),
      confidence: 0,
      version: 0,
      updatedAt: new Date(),
    };
  }

  private emptyEvidence(): Record<TeachingStrategy, StrategyEvidence> {
    const strategies: TeachingStrategy[] = [
      'EXPLAIN', 'ASK', 'HINT', 'WORKED_EXAMPLE', 'GUIDED_EXAMPLE',
      'SOCRATIC', 'COUNTEREXAMPLE', 'PRACTICE', 'REMEDIATE', 'REVIEW',
      'CHALLENGE', 'TRANSFER',
    ];
    const evidence = {} as Record<TeachingStrategy, StrategyEvidence>;
    for (const s of strategies) {
      evidence[s] = {
        strategy: s,
        attempts: 0,
        successes: 0,
        averageScoreDelta: 0,
        consecutiveFailures: 0,
      };
    }
    return evidence;
  }

  recordOutcome(policy: PersonalPolicy, input: PersonalPolicyUpdateInput): PersonalPolicy {
    const evidence = policy.strategyEvidence[input.strategy];
    if (!evidence) return policy;

    const attempts = evidence.attempts + 1;
    const successes = evidence.successes + (input.wasCorrect ? 1 : 0);
    const averageScoreDelta =
      (evidence.averageScoreDelta * evidence.attempts + input.scoreDelta) / attempts;
    const consecutiveFailures = input.wasCorrect ? 0 : evidence.consecutiveFailures + 1;

    const updatedEvidence: Record<TeachingStrategy, StrategyEvidence> = {
      ...policy.strategyEvidence,
      [input.strategy]: {
        strategy: input.strategy,
        attempts,
        successes,
        averageScoreDelta,
        consecutiveFailures,
        lastUsedAt: new Date(),
      },
    };

    const confidence = this.updateConfidence(policy.confidence, input.wasCorrect, averageScoreDelta);
    const preferredStrategy = this.derivePreference(updatedEvidence);

    return {
      ...policy,
      strategyEvidence: updatedEvidence,
      confidence,
      preferredStrategy,
      version: policy.version + 1,
      updatedAt: new Date(),
    };
  }

  reset(userId: string): PersonalPolicy {
    return {
      ...this.buildEmpty(userId),
      version: 1,
    };
  }

  private updateConfidence(current: number, wasCorrect: boolean, averageScoreDelta: number): number {
    const direction = wasCorrect ? 1 : -1;
    const deltaMagnitude = Math.min(0.05, Math.abs(averageScoreDelta));
    const next = current + direction * deltaMagnitude * POLICY_RULES.SMOOTHING_FACTOR;
    return Math.max(0, Math.min(1, next));
  }

  private derivePreference(evidence: Record<TeachingStrategy, StrategyEvidence>): TeachingStrategy | undefined {
    const candidates = Object.values(evidence)
      .filter((s) => s.attempts >= POLICY_RULES.MIN_EVIDENCE_BEFORE_PREFERENCE)
      .map((s) => ({ strategy: s.strategy, rate: s.successes / s.attempts }))
      .filter((c) => c.rate >= POLICY_RULES.MIN_SUCCESS_RATE_FOR_PREFERENCE)
      .sort((a, b) => b.rate - a.rate);

    if (candidates.length === 0) return undefined;
    return candidates[0].strategy;
  }

  hasSufficientEvidence(policy: PersonalPolicy): boolean {
    const totalAttempts = Object.values(policy.strategyEvidence).reduce(
      (sum, e) => sum + e.attempts,
      0,
    );
    return totalAttempts >= POLICY_RULES.MIN_EVIDENCE_BEFORE_PREFERENCE;
  }
}
