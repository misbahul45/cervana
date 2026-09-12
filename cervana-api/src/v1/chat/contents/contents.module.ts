import { forwardRef, Module } from '@nestjs/common';
import { ContentsService } from './contents.service';
import { ContentsController } from './contents.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { ContentsRepo } from './contents.repo';
import { ChatMessagesModule } from '@/v1/chat/chat-messages/chat-messages.module';
import { QueueModule } from '@/v1/queue/queue.module';
import { ContentSseModule } from '@/v1/sse/content-sse/content-sse.module';

@Module({
  controllers: [ContentsController],
  providers: [ContentsService, ContentsRepo],
  imports:[PrismaModule, ChatMessagesModule,
     forwardRef(() => QueueModule), 
     ContentSseModule
  ],
  exports: [ContentsService, ContentsRepo]
})
export class ContentsModule {}
