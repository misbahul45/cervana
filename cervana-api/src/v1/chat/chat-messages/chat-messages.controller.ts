import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ChatMessagesService } from './chat-messages.service';
import { CreateChatMessageDto, CreateChatMessageDtoType, UpdateChatMessageDto, UpdateChatMessageDtoType } from './chat-messages.dto';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { ApiCrudDocs } from '@/common/lib/docs';
import { BaseChatMessageSchema } from '@/common/docs/chat.doc';
import { ChatsService } from '../chats/chats.service';
import { ChatMessagesSseService } from '@/v1/sse/chat-messages-sse/chat-messages-sse.service';

@Controller('chat-messages')
export class ChatMessagesController {
  constructor(
    private readonly chatMessagesService: ChatMessagesService,
    private readonly ChatMessageSseService: ChatMessagesSseService
  ) {}

  @Post()
  @ApiCrudDocs.create(BaseChatMessageSchema, CreateChatMessageDto, 'Chat Message')
  async create(@Body(new ZodPipe(CreateChatMessageDto)) createChatMessageDto: CreateChatMessageDtoType) {
    const res=await this.chatMessagesService.create(createChatMessageDto);
    this.ChatMessageSseService.emitUpdate(res.data.chatId);
    return res;
  }

  @Patch(':id')
  @ApiCrudDocs.update(UpdateChatMessageDto, 'Chat Message')
  async update(@Param('id') id: string, @Body(new ZodPipe(UpdateChatMessageDto)) updateChatMessageDto: UpdateChatMessageDtoType) {
    const res=await this.chatMessagesService.update(id, updateChatMessageDto);
    this.ChatMessageSseService.emitUpdate(res.data.chatId);
    return res;
  }

  @Delete(':id')
  @ApiCrudDocs.delete('Chat Message')
  remove(@Param('id') id: string) {
    return this.chatMessagesService.remove(id);
  }
}
