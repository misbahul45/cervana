import { Module } from '@nestjs/common';
import { DailyLogsService } from './daily-logs.service';
import { DailyLogsController } from './daily-logs.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { DailylogsRepo } from './daily-logs.repo';
import { EmittersModule } from '@/v1/emitters/emitters.module';

@Module({
  imports: [PrismaModule, EmittersModule],
  controllers: [DailyLogsController],
  providers: [DailyLogsService, DailylogsRepo],
  exports: [DailyLogsService, DailylogsRepo], 
})
export class DailyLogsModule {}
