import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { LearnerModelModule } from '@/v1/learner-model/learner-model.module';
import { RewardEngineService } from './reward-engine.service';
import { NodeRewardService } from './node-reward.service';
import { RewardLedgerService } from './reward-ledger.service';
import { RewardRulesService } from './reward-rules.service';
import { RewardsController } from './rewards.controller';

@Module({
  imports: [PrismaModule, LearnerModelModule],
  controllers: [RewardsController],
  providers: [RewardLedgerService, RewardRulesService, RewardEngineService, NodeRewardService],
  exports: [RewardLedgerService, RewardRulesService, RewardEngineService, NodeRewardService],
})
export class RewardsModule {}
