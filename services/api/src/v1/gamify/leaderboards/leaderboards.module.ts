import { Module } from '@nestjs/common';
import { LeaderboardsService } from './leaderboards.service';
import { LeaderboardsController } from './leaderboards.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { LeaderboardsRepo } from './leaderboards.repo';
import { LeaderboardSseModule } from '@/v1/sse/leaderboard-sse/leaderboard-sse.module';
import { EmittersModule } from '@/v1/emitters/emitters.module';

@Module({
  imports:[PrismaModule, LeaderboardSseModule, EmittersModule],
  controllers: [LeaderboardsController],
  providers: [LeaderboardsService, LeaderboardsRepo],
  exports: [LeaderboardsService, LeaderboardsRepo],
})
export class LeaderboardsModule {}
