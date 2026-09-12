import { forwardRef, Module } from '@nestjs/common';
import { ChatMessagesService } from './chat-messages.service';
import { ChatMessagesController } from './chat-messages.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { ChatMessagesRepo } from './chat-messages.repo';
import { ChatsModule } from '../chats/chats.module';
import { ChatMessagesSseModule } from '@/v1/sse/chat-messages-sse/chat-messages-sse.module';

@Module({
  controllers: [ChatMessagesController],
  providers: [ChatMessagesService, ChatMessagesRepo],
  imports:[PrismaModule, ChatMessagesSseModule
  ],
  exports: [ChatMessagesService, ChatMessagesRepo]
})
export class ChatMessagesModule {}
