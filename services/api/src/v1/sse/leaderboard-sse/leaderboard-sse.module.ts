import { Module } from '@nestjs/common';
import { LeaderboardSseService } from './leaderboard-sse.service';
import { LeaderboardSseController } from './leaderboard-sse.controller';
import { AuthModule } from '@/v1/auth/auth.module';

@Module({
  imports:[AuthModule],
  providers: [LeaderboardSseService],
  controllers:[LeaderboardSseController],
  exports:[LeaderboardSseService],
})
export class LeaderboardSseModule {}
