import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { UserStepsService } from './user-steps.service';
import { UserStepsController } from './user-steps.controller';
import { UserStepsRepo } from './user-steps.repo';
import { LeaderboardsModule } from '@/v1/gamify/leaderboards/leaderboards.module';
import { ActivityDetectorInterceptor } from '@/common/interceptors/daily-activity.interceptor';
import { DailyLogsModule } from '@/v1/gamify/daily-logs/daily-logs.module';
import { StreaksModule } from '@/v1/gamify/streaks/streaks.module';

@Module({
  imports: [PrismaModule, LeaderboardsModule, DailyLogsModule, StreaksModule],
  controllers: [UserStepsController],
  providers: [UserStepsService, UserStepsRepo, ActivityDetectorInterceptor],
  exports: [UserStepsRepo, UserStepsService],
})
export class UserStepsModule {}