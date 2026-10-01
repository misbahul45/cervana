import { Injectable } from '@nestjs/common';

export type EvidenceWeight = 'INDEPENDENT_CORRECT' | 'CORRECT_AFTER_HINT' | 'CORRECT_AFTER_FULL_EXPLANATION' | 'TRANSFER_SUCCESS' | 'REPEATED_SIMILAR_SUCCESS';

export interface MasteryAttemptInput {
  currentScore: number;
  currentConfidence: number;
  currentEvidenceCount: number;
  isCorrect: boolean;
  hintUsed: boolean;
  fullExplanationSeen: boolean;
  isTransfer: boolean;
  isOffTopic: boolean;
  /** observed difficulty for the question (0..1) */
  itemDifficulty: number;
}

export interface MasteryUpdate {
  score: number;
  confidence: number;
  evidenceCount: number;
  appliedWeight: EvidenceWeight;
  delta: number;
}

const HINT_PENALTY = 0.4;
const EXPLANATION_PENALTY = 0.6;
const TRANSFER_BONUS = 0.2;

@Injectable()
export class MasteryService {
  update(attempt: MasteryAttemptInput): MasteryUpdate {
    if (attempt.isOffTopic) {
      return {
        score: attempt.currentScore,
        confidence: attempt.currentConfidence,
        evidenceCount: attempt.currentEvidenceCount,
        appliedWeight: 'INDEPENDENT_CORRECT',
        delta: 0,
      };
    }

    if (attempt.fullExplanationSeen) {
      return {
        score: attempt.currentScore,
        confidence: attempt.currentConfidence,
        evidenceCount: attempt.currentEvidenceCount,
        appliedWeight: 'CORRECT_AFTER_FULL_EXPLANATION',
        delta: 0,
      };
    }

    if (attempt.hintUsed && attempt.isCorrect) {
      return {
        score: attempt.currentScore,
        confidence: attempt.currentConfidence,
        evidenceCount: attempt.currentEvidenceCount,
        appliedWeight: 'CORRECT_AFTER_HINT',
        delta: 0,
      };
    }

    let observedQuality: number;
    let weight: EvidenceWeight;

    if (attempt.isTransfer && attempt.isCorrect) {
      observedQuality = 1 + TRANSFER_BONUS;
      weight = 'TRANSFER_SUCCESS';
    } else if (attempt.isCorrect) {
      observedQuality = 1;
      weight = attempt.itemDifficulty > 0.7 ? 'REPEATED_SIMILAR_SUCCESS' : 'INDEPENDENT_CORRECT';
    } else {
      observedQuality = 0;
      weight = 'INDEPENDENT_CORRECT';
    }

    const expected = 1 / (1 + Math.exp(-(attempt.itemDifficulty - 0.5) * 4));
    const surprise = observedQuality - expected;
    const k = this.kFactor(attempt.itemDifficulty, attempt.currentEvidenceCount);
    const delta = k * surprise;

    const nextScore = this.clamp(attempt.currentScore + delta, 0, 1);
    const nextEvidence = Math.min(attempt.currentEvidenceCount + 1, 100);
    const nextConfidence = this.updateConfidence(attempt.currentConfidence, nextEvidence, Math.abs(surprise));

    return {
      score: nextScore,
      confidence: nextConfidence,
      evidenceCount: nextEvidence,
      appliedWeight: weight,
      delta,
    };
  }

  private kFactor(itemDifficulty: number, evidenceCount: number): number {
    const baseK = 32;
    const adaptive = Math.max(0.25, 1 - evidenceCount / 30);
    const difficulty = itemDifficulty >= 0.7 ? 0.85 : 1;
    return baseK * adaptive * difficulty;
  }

  private updateConfidence(current: number, evidence: number, surpriseMagnitude: number): number {
    const stability = Math.min(1, evidence / 25);
    const adjusted = current + (stability - current) * 0.1 - surpriseMagnitude * 0.05;
    return this.clamp(adjusted, 0.05, 0.99);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
