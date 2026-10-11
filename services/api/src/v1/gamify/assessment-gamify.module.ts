import { Module } from '@nestjs/common';
import { AchievementsModule } from './achievements/achievements.module';
import { AssessmentGamifyService } from './assessment-gamify.service';
import { RewardsModule } from './rewards/rewards.module';
import { StreaksModule } from './streaks/streaks.module';

@Module({
  imports: [RewardsModule, StreaksModule, AchievementsModule],
  providers: [AssessmentGamifyService],
  exports: [AssessmentGamifyService],
})
export class AssessmentGamifyModule {}
