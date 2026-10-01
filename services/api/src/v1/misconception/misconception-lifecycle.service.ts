import { Injectable } from '@nestjs/common';

export type MisconceptionLifecycleStatus = 'TENTATIVE' | 'CONFIRMED' | 'RESOLVED' | 'STALE';

export interface MisconceptionObservation {
  userId: string;
  conceptKey: string;
}

export interface MisconceptionState {
  status: MisconceptionLifecycleStatus;
  count: number;
  confidence: number;
  distinctEvidenceKeys: number;
  needsLlmConfirmation: boolean;
  shouldAutoResolve: boolean;
}

export const MISCONCEPTION_RULES = {
  /** Minimum observations to consider a misconception */
  TENTATIVE_THRESHOLD: 2,
  /** Minimum observations + distinct evidence to CONFIRM */
  CONFIRM_OBSERVATIONS: 4,
  CONFIRM_DISTINCT_EVIDENCE: 2,
  /** Consecutive correct on the same concept key to auto-resolve */
  AUTO_RESOLVE_STREAK: 5,
  /** Stale if not seen for N days */
  STALE_DAYS: 60,
} as const;

@Injectable()
export class MisconceptionLifecycleService {
  classify(input: {
    count: number;
    distinctEvidenceKeys: number;
    consecutiveCorrect: number;
    daysSinceLastSeen: number;
  }): Omit<MisconceptionState, 'confidence' | 'needsLlmConfirmation'> & { confidence: number; needsLlmConfirmation: boolean } {
    const isStale = input.daysSinceLastSeen > MISCONCEPTION_RULES.STALE_DAYS;

    if (input.consecutiveCorrect >= MISCONCEPTION_RULES.AUTO_RESOLVE_STREAK) {
      return {
        status: 'RESOLVED',
        count: input.count,
        distinctEvidenceKeys: input.distinctEvidenceKeys,
        shouldAutoResolve: true,
        confidence: 1,
        needsLlmConfirmation: false,
      };
    }

    if (isStale) {
      return {
        status: 'STALE',
        count: input.count,
        distinctEvidenceKeys: input.distinctEvidenceKeys,
        shouldAutoResolve: false,
        confidence: 0,
        needsLlmConfirmation: false,
      };
    }

    const meetsTentative = input.count >= MISCONCEPTION_RULES.TENTATIVE_THRESHOLD;
    const meetsConfirmed =
      input.count >= MISCONCEPTION_RULES.CONFIRM_OBSERVATIONS &&
      input.distinctEvidenceKeys >= MISCONCEPTION_RULES.CONFIRM_DISTINCT_EVIDENCE;

    if (meetsConfirmed) {
      return {
        status: 'CONFIRMED',
        count: input.count,
        distinctEvidenceKeys: input.distinctEvidenceKeys,
        shouldAutoResolve: false,
        confidence: 0.9,
        needsLlmConfirmation: false,
      };
    }

    if (meetsTentative) {
      return {
        status: 'TENTATIVE',
        count: input.count,
        distinctEvidenceKeys: input.distinctEvidenceKeys,
        shouldAutoResolve: false,
        confidence: 0.5,
        needsLlmConfirmation: true,
      };
    }

    return {
      status: 'TENTATIVE',
      count: input.count,
      distinctEvidenceKeys: input.distinctEvidenceKeys,
      shouldAutoResolve: false,
      confidence: 0.2,
      needsLlmConfirmation: false,
    };
  }

  isSlip(input: { distinctEvidenceKeys: number; count: number }): boolean {
    return (
      input.count === 1 &&
      input.distinctEvidenceKeys === 1
    );
  }
}
