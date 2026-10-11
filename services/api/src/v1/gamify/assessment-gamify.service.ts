import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AchievementEvaluator, UnlockedAchievement } from './achievements/achievement-evaluator';
import { NodeRewardService } from './rewards/node-reward.service';
import { StreakEngineService } from './streaks/streak-engine.service';

export interface AssessmentGamifyInput {
  userId: string;
  subTopicId: string | null | undefined;
  at: Date;
  xpGained: number;
}

export interface AssessmentGamifyOutcome {
  xpGained: number;
  starsGained: number;
  streak: {
    current: number;
    longest: number;
    freezes: number;
    extended: boolean;
    freezeEarned: boolean;
    freezesUsed: number;
    bonusPoints: number;
  };
  achievements: UnlockedAchievement[];
}

@Injectable()
export class AssessmentGamifyService {
  constructor(
    private readonly nodes: NodeRewardService,
    private readonly streaks: StreakEngineService,
    private readonly achievements: AchievementEvaluator,
  ) {}

  async afterAssessment(input: AssessmentGamifyInput, tx: Prisma.TransactionClient): Promise<AssessmentGamifyOutcome> {
    const { stars } = await this.nodes.onAssessment({ userId: input.userId, subTopicId: input.subTopicId }, tx);
    const streak = await this.streaks.onQualified({ userId: input.userId, at: input.at }, tx);
    const unlocked = await this.achievements.evaluate(input.userId, tx);

    return {
      xpGained: input.xpGained + streak.bonusPoints,
      starsGained: stars,
      streak: {
        current: streak.current,
        longest: streak.longest,
        freezes: streak.freezes,
        extended: streak.extended,
        freezeEarned: streak.freezeEarned,
        freezesUsed: streak.freezesUsed,
        bonusPoints: streak.bonusPoints,
      },
      achievements: unlocked,
    };
  }
}
