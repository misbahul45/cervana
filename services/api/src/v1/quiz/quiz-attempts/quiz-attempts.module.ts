import { Module } from '@nestjs/common';
import { QuizAttemptsService } from './quiz-attempts.service';
import { QuizAttemptsController } from './quiz-attempts.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { QuizAttemptsRepo } from './quiz-attempts.repo';
import { ActivityDetectorInterceptor } from '@/common/interceptors/daily-activity.interceptor';
import { DailyLogsModule } from '@/v1/gamify/daily-logs/daily-logs.module';
import { StreaksModule } from '@/v1/gamify/streaks/streaks.module';
import { MisconceptionModule } from '@/v1/personalization/misconception/misconception.module';
import { AnalyticsModule } from '@/v1/analytics/analytics.module';
import { QuizModule } from '@/v1/quiz/services/quiz.module';
import { LearnerModelModule } from '@/v1/learner-model/learner-model.module';
import { RewardsModule } from '@/v1/gamify/rewards/rewards.module';
import { AssessmentGamifyModule } from '@/v1/gamify/assessment-gamify.module';
import { QuizAccessService } from '../quiz-access.service';

@Module({
  controllers: [QuizAttemptsController],
  providers: [QuizAttemptsService, QuizAttemptsRepo, ActivityDetectorInterceptor, QuizAccessService],
  imports: [
    PrismaModule,
    DailyLogsModule,
    StreaksModule,
    MisconceptionModule,
    AnalyticsModule,
    QuizModule,
    LearnerModelModule,
    RewardsModule,
    AssessmentGamifyModule,
  ],
  exports: [QuizAttemptsService, QuizAttemptsRepo],
})
export class QuizAttemptsModule {}
