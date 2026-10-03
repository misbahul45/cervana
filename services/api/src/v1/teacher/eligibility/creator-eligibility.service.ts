import { Injectable } from '@nestjs/common';
import { MasteryRepo } from '@/v1/personalization/mastery/mastery.repo';

const ELIGIBILITY_THRESHOLD = 0.85;

@Injectable()
export class CreatorEligibilityService {
  constructor(private readonly masteryRepo: MasteryRepo) {}

  async check(input: { userId: string; topicId: string }): Promise<{ eligible: boolean; score: number | null }> {
    const m = await this.masteryRepo.findByUserAndTopic(input.userId, input.topicId);
    const score = m?.score ?? null;
    return { eligible: score !== null && score >= ELIGIBILITY_THRESHOLD, score };
  }
}