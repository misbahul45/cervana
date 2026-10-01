import { Module } from '@nestjs/common';
import { UserTopicsService } from './user-topics.service';
import { UserTopicsController } from './user-topics.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { UserTopicsRepo } from './user-topics.repo';
import { LeaderboardsModule } from '@/v1/gamify/leaderboards/leaderboards.module';

@Module({
  imports:[PrismaModule, LeaderboardsModule],
  controllers: [UserTopicsController],
  providers: [UserTopicsService, UserTopicsRepo],
  exports: [UserTopicsService, UserTopicsRepo]
})
export class UserTopicsModule {}
