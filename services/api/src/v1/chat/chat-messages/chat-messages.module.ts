import { forwardRef, Module } from '@nestjs/common';
import { ChatMessagesService } from './chat-messages.service';
import { ChatMessagesController } from './chat-messages.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { ChatMessagesRepo } from './chat-messages.repo';
import { ChatsModule } from '../chats/chats.module';
import { ChatMessagesSseModule } from '@/v1/sse/chat-messages-sse/chat-messages-sse.module';
import { ActivityDetectorInterceptor } from '@/common/interceptors/daily-activity.interceptor';
import { DailyLogsModule } from '@/v1/gamify/daily-logs/daily-logs.module';
import { StreaksModule } from '@/v1/gamify/streaks/streaks.module';
import { RateLimitModule } from '@/v1/common/rate-limit/rate-limit.module';

@Module({
  controllers: [ChatMessagesController],
  providers: [ChatMessagesService, ChatMessagesRepo, ActivityDetectorInterceptor],
  imports: [PrismaModule, ChatMessagesSseModule, DailyLogsModule, StreaksModule, RateLimitModule],
  exports: [ChatMessagesService, ChatMessagesRepo],
})
export class ChatMessagesModule {}