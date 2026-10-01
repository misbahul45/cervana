import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ChatsModule } from './chats/chats.module';
import { ChatMessagesModule } from './chat-messages/chat-messages.module';
import { ContentsModule } from './contents/contents.module';

@Module({
  imports: [
    RouterModule.register([
      {
        path: 'chat',
        children: [
          { path: '', module: ChatsModule },
          { path: '', module: ChatMessagesModule },
          { path: '', module: ContentsModule },
        ],
      },
    ]),

    ChatsModule,
    ChatMessagesModule,
    ContentsModule,
  ],
  exports: [ChatsModule, ChatMessagesModule, ContentsModule],
})
export class ChatModule {}
