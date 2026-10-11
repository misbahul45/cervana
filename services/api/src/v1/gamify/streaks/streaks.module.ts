import { Module } from '@nestjs/common';
import { StreaksService } from './streaks.service';
import { StreaksController } from './streaks.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { StreaksRepo } from './streaks.repo';
import { StreakEngineService } from './streak-engine.service';
import { EmittersModule } from '@/v1/emitters/emitters.module';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [PrismaModule, EmittersModule, RewardsModule],
  controllers: [StreaksController],
  providers: [StreaksService, StreaksRepo, StreakEngineService],
  exports: [StreaksService, StreaksRepo, StreakEngineService],
})
export class StreaksModule {}

