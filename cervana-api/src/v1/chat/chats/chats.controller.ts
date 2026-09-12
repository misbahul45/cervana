import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { CreateChatDto, CreateChatDtoType } from './chats.dto';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { Query as QueryInterface } from '@/common/interfaces';
import { ApiCrudDocs } from '@/common/lib/docs';
import { BaseChatSchema, ChatDetailSchema, ChatMessageListSchema } from '@/common/docs/chat.doc';
@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post()
  @ApiCrudDocs.create(BaseChatSchema, CreateChatDto, 'Chat')
  create(@Body(new ZodPipe(CreateChatDto)) createChatDto: CreateChatDtoType) {
    return this.chatsService.create(createChatDto);
  }

  @Get(':id')
  @ApiCrudDocs.findOne(ChatDetailSchema, 'Chat')
  findOne(
    @Param('id') id: string,
    @Query() query: QueryInterface 
  ) {
    return this.chatsService.findOne(id, query);
  }

  @Get(':id/messages')
  @ApiCrudDocs.findAll(ChatMessageListSchema, 'ChatMessage', true)
  findAllMessages(
    @Param('id') id: string,
    @Query() query: QueryInterface  
  ){
    return this.chatsService.findAllMessages(id, query)
  }

  @Delete(':id')
  @ApiCrudDocs.delete('Chat')
  remove(@Param('id') id: string) {
    return this.chatsService.remove(id);
  }
}
