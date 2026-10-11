import { Injectable } from '@nestjs/common';
import { LearnerStateService } from '@/v1/learner-model/learner-state.service';
import { isCreatorEligible } from '@/v1/learner-model/mastery/topic-aggregate';

export interface EligibilityResult {
  eligible: boolean;
  score: number | null;
  passedConcepts: number;
  totalConcepts: number;
}

const NOT_ELIGIBLE: EligibilityResult = { eligible: false, score: null, passedConcepts: 0, totalConcepts: 0 };

@Injectable()
export class CreatorEligibilityService {
  constructor(private readonly state: LearnerStateService) {}

  async check(input: { userId: string; topicId: string }): Promise<EligibilityResult> {
    if (!input.topicId) return { ...NOT_ELIGIBLE };
    const aggregate = await this.state.topicMastery(input.userId, input.topicId);
    return {
      eligible: isCreatorEligible(aggregate),
      score: aggregate.score,
      passedConcepts: aggregate.passedConcepts,
      totalConcepts: aggregate.totalConcepts,
    };
  }
}
