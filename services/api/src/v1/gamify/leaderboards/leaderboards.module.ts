import { Module } from '@nestjs/common';
import { LeaderboardsService } from './leaderboards.service';
import { LeaderboardsController } from './leaderboards.controller';
import { TopicBoardController } from './topic-board.controller';
import { TopicBoardService } from './topic-board.service';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { LeaderboardsRepo } from './leaderboards.repo';
import { LeaderboardSseModule } from '@/v1/sse/leaderboard-sse/leaderboard-sse.module';
import { EmittersModule } from '@/v1/emitters/emitters.module';

@Module({
  imports:[PrismaModule, LeaderboardSseModule, EmittersModule],
  controllers: [TopicBoardController, LeaderboardsController],
  providers: [LeaderboardsService, LeaderboardsRepo, TopicBoardService],
  exports: [LeaderboardsService, LeaderboardsRepo],
})
export class LeaderboardsModule {}
