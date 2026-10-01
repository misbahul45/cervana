import { RequireOwnership, RequireParentOwnership } from '@/v1/common/guards/ownership.decorator';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, NotFoundException } from '@nestjs/common';
import { ContentsService } from './contents.service';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { Query as ContentQuery, } from '@/common/interfaces';
import { ContentSseService } from '@/v1/sse/content-sse/content-sse.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Controller('contents')
export class ContentsController {
  constructor(
    private readonly contentsService: ContentsService,
    private readonly contentsSseService: ContentSseService,
    private readonly prisma: PrismaService,
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
  async findSimilar(
    @Query('chatId') chatId: string,
    @Query('query') query: string,
  ) {
    if (!chatId || !query) {
      throw new AppError(
        'chatId and query are required',
        400,
        AppErrorCode.VALIDATION_ERROR,
      );
    }

    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        userStep: { select: { userId: true } },
      },
    });

    if (!chat) {
      throw new NotFoundException(`Chat ${chatId} not found`);
    }

    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    if (tokens.length === 0) {
      return { data: [] };
    }

    const contents = await this.prisma.content.findMany({
      where: {
        chatId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const ranked = contents
      .map((c) => ({
        id: c.id,
        chatId: c.chatId,
        text: c.data ?? '',
        score: scoreContent(c.data ?? '', tokens),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return { data: ranked };
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

function scoreContent(text: string, tokens: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (lower.includes(t)) hits += 1;
  }
  return hits / tokens.length;
}