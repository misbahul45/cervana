import { Module } from '@nestjs/common';
import { StreakSseService } from './streak-sse.service';
import { StreakSseController } from './streak-sse.controller';
import { AuthModule } from '@/v1/auth/auth.module';

@Module({
  imports:[AuthModule],
  controllers:[StreakSseController],
  providers: [StreakSseService]
})
export class StreakSseModule {}
