import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { UserStepsService } from './user-steps.service';
import { UserStepsController } from './user-steps.controller';
import { UserStepsRepo } from './user-steps.repo';
import { LeaderboardsModule } from '@/v1/gamify/leaderboards/leaderboards.module';

@Module({
  imports: [PrismaModule, LeaderboardsModule],
  controllers: [UserStepsController],
  providers: [UserStepsService, UserStepsRepo],
  exports:[UserStepsRepo, UserStepsService]
})
export class UserStepsModule {}
