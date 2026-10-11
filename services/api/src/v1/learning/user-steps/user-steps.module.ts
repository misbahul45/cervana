import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { UserStepsService } from './user-steps.service';
import { UserStepsController } from './user-steps.controller';
import { UserStepsRepo } from './user-steps.repo';
import { ActivityDetectorInterceptor } from '@/common/interceptors/daily-activity.interceptor';
import { DailyLogsModule } from '@/v1/gamify/daily-logs/daily-logs.module';
import { StreaksModule } from '@/v1/gamify/streaks/streaks.module';
import { AnalyticsModule } from '@/v1/analytics/analytics.module';

@Module({
  imports: [PrismaModule, DailyLogsModule, StreaksModule, AnalyticsModule],
  controllers: [UserStepsController],
  providers: [UserStepsService, UserStepsRepo, ActivityDetectorInterceptor],
  exports: [UserStepsRepo, UserStepsService],
})
export class UserStepsModule {}