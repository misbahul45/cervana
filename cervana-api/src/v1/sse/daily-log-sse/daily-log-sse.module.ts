import { Module } from '@nestjs/common';
import { DailyLogSseService } from './daily-log-sse.service';
import { DailyLogSseController } from './daily-log-sse.controller';
import { AuthModule } from '@/v1/auth/auth.module';

@Module({
  imports:[AuthModule],
  providers: [DailyLogSseService],
  controllers:[DailyLogSseController]
})
export class DailyLogSseModule {}
