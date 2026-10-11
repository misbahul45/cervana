import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { ACHIEVEMENT_METRIC_SOURCE, AchievementEvaluator } from './achievement-evaluator';
import { AchievementsController } from './achievements.controller';
import { PrismaMetricSource } from './prisma-metric-source';

@Module({
  imports: [PrismaModule],
  controllers: [AchievementsController],
  providers: [AchievementEvaluator, { provide: ACHIEVEMENT_METRIC_SOURCE, useClass: PrismaMetricSource }],
  exports: [AchievementEvaluator],
})
export class AchievementsModule {}
