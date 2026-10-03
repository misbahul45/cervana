import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { LevelController } from './level.controller';
import { LevelService } from './level-calculation.service';
import { DailyLogsService } from '../daily-logs/daily-logs.service';
import { DailyLogsModule } from '../daily-logs/daily-logs.module';

@Module({
  imports: [PrismaModule, DailyLogsModule],
  controllers: [LevelController],
  providers: [
    LevelService,
    {
      provide: LevelService,
      inject: [DailyLogsService],
      useFactory: (daily: DailyLogsService) => new LevelService({
        sumXpForUser: async (userId: string) => {
          const count = await daily.findAll({ page: 1, limit: 999, userId });
          return (count?.data?.data?.length ?? 0) * 10;
        },
      }),
    },
  ],
  exports: [LevelService],
})
export class LevelModule {}