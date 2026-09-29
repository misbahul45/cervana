import { Module } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { ChatsRepo } from './chats.repo';
import { ChatMessagesModule } from '../chat-messages/chat-messages.module';
import { OwnershipGuard } from '@/v1/common/guards/ownership.guard';

@Module({
  controllers: [ChatsController],
  providers: [ChatsService, ChatsRepo, OwnershipGuard],
  imports:[PrismaModule, ChatMessagesModule],
  exports: [ChatsService, ChatsRepo, OwnershipGuard]
})
export class ChatsModule {}
