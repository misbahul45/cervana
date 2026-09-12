import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ContentsService } from './contents.service';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { Query as ContentQuery, } from '@/common/interfaces';
import { ContentSseService } from '@/v1/sse/content-sse/content-sse.service';

@Controller('contents')
export class ContentsController {
  constructor(
    private readonly contentsService: ContentsService,
    private readonly contentsSseService: ContentSseService,
  ) {}

  @Get()
  findAll(
    @Query() q:ContentQuery
  ){
    if(!q.chatId){
      throw new AppError("chat id is required", 400, AppErrorCode.INTERNAL_SERVER_ERROR)
    }
    return this.contentsService.findAll(q)
  }
  @Post()
  async create(
    @Body() createContentDto: any
  ) {
    const res=await this.contentsService.create(createContentDto);
    this.contentsSseService.emitUpdate(res.data.chatId);
    return res;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contentsService.remove(id);
  }
}
