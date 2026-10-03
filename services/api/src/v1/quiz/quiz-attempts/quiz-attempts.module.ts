import { Module } from '@nestjs/common';
import { QuizAttemptsService } from './quiz-attempts.service';
import { QuizAttemptsController } from './quiz-attempts.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { QuizAttemptsRepo } from './quiz-attempts.repo';
import { ActivityDetectorInterceptor } from '@/common/interceptors/daily-activity.interceptor';
import { DailyLogsModule } from '@/v1/gamify/daily-logs/daily-logs.module';
import { StreaksModule } from '@/v1/gamify/streaks/streaks.module';
import { MasteryModule } from '@/v1/personalization/mastery/mastery.module';
import { MisconceptionModule } from '@/v1/personalization/misconception/misconception.module';
import { AnalyticsModule } from '@/v1/analytics/analytics.module';
import { QuizModule } from '@/v1/quiz/services/quiz.module';

@Module({
  controllers: [QuizAttemptsController],
  providers: [QuizAttemptsService, QuizAttemptsRepo, ActivityDetectorInterceptor],
  imports: [
    PrismaModule,
    DailyLogsModule,
    StreaksModule,
    MasteryModule,
    MisconceptionModule,
    AnalyticsModule,
    QuizModule,
  ],
  exports: [QuizAttemptsService, QuizAttemptsRepo],
})
export class QuizAttemptsModule {}
