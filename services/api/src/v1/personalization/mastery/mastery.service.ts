import { Injectable } from '@nestjs/common';
import { MasteryRepo } from './mastery.repo';

export interface ComputeNextScoreInput {
  previousScore: number | null;
  previousAttempts: number;
  attemptScore: number;
  alpha?: number;
}

export interface MasteryUpdateResult {
  score: number;
  attempts: number;
}

@Injectable()
export class MasteryService {
  constructor(
    private readonly repo: MasteryRepo,
    private readonly defaultAlpha: number = 0.3,
  ) {}

  computeNextScore(input: ComputeNextScoreInput): number {
    const a = input.alpha ?? this.defaultAlpha;
    const clamped = Math.max(0, Math.min(1, input.attemptScore));
    if (input.previousScore === null || input.previousAttempts === 0) {
      return clamped;
    }
    return Math.max(0, Math.min(1, a * clamped + (1 - a) * input.previousScore));
  }

  async updateFromAttempt(
    userId: string,
    topicId: string,
    attemptScore: number,
    alpha?: number,
  ): Promise<MasteryUpdateResult> {
    const existing = await this.repo.findByUserAndTopic(userId, topicId);
    const next = this.computeNextScore({
      previousScore: existing?.score ?? null,
      previousAttempts: existing?.evidenceCount ?? 0,
      attemptScore,
      alpha,
    });
    const upserted = await this.repo.upsert({
      userId,
      topicId,
      score: next,
      lastObservedAt: new Date(),
    });
    return { score: upserted.score, attempts: upserted.evidenceCount };
  }

  async listByUser(userId: string) {
    return this.repo.listByUser(userId);
  }
}