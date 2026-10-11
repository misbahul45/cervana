import { RequireOwnership, RequireParentOwnership } from '@/v1/common/guards/ownership.decorator';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ContentsService } from './contents.service';
import { ContentSimilarityService } from './content-similarity.service';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { Query as ContentQuery, } from '@/common/interfaces';
import { ContentSseService } from '@/v1/sse/content-sse/content-sse.service';

@Controller('contents')
export class ContentsController {
  constructor(
    private readonly contentsService: ContentsService,
    private readonly contentsSseService: ContentSseService,
    private readonly contentSimilarityService: ContentSimilarityService,
  ) {}

  @Get()
  @RequireParentOwnership('chat', 'chatId', 'query')
  findAll(
    @Query() q:ContentQuery
  ){
    if(!q.chatId){
      throw new AppError("chat id is required", 400, AppErrorCode.INTERNAL_SERVER_ERROR)
    }
    return this.contentsService.findAll(q)
  }

  @Get('similarity')
  @RequireParentOwnership('chat', 'chatId', 'query')
  findSimilar(
    @Query('chatId') chatId: string,
    @Query('query') query: string,
  ) {
    return this.contentSimilarityService.findSimilar(chatId, query);
  }

  @Post()
  @RequireParentOwnership('chat', 'chatId')
  async create(
    @Body() createContentDto: any
  ) {
    const res=await this.contentsService.create(createContentDto);
    this.contentsSseService.emitUpdate(res.data.chatId);
    return res;
  }

  @Delete(':id')
  @RequireOwnership('content')
  remove(@Param('id') id: string) {
    return this.contentsService.remove(id);
  }
}
