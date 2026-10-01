import { Module } from '@nestjs/common';
import { StreaksService } from './streaks.service';
import { StreaksController } from './streaks.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { StreaksRepo } from './streaks.repo';
import { EmittersModule } from '@/v1/emitters/emitters.module';
import { LeaderboardsModule } from '../leaderboards/leaderboards.module';

@Module({
  imports: [PrismaModule, EmittersModule, LeaderboardsModule], 
  controllers: [StreaksController],
  providers: [StreaksService, StreaksRepo],
  exports: [StreaksService, StreaksRepo],
})
export class StreaksModule {}

