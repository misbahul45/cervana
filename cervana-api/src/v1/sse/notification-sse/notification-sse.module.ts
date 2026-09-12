import { Module } from '@nestjs/common';
import { NotificationSseService } from './notification-sse.service';
import { NotificationSseController } from './notification-sse.controller';
import { AuthModule } from '@/v1/auth/auth.module';

@Module({
  imports:[AuthModule],
  providers: [NotificationSseService],
  controllers:[NotificationSseController]
})
export class NotificationSseModule {}
