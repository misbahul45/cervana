import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TraceId } from '@/common/authz/trace-id.decorator';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { GetUser, Roles } from '../auth/auth.decorator';
import { OptionalNoteDto, OptionalNoteDtoType, ReasonDto, ReasonDtoType } from '../marketplace/marketplace.dto';
import { AdminArticleQueryDto, AdminArticleQueryDtoType } from './articles.dto';
import { ArticleModerationService } from './article-moderation.service';

@Controller('admin/articles')
export class AdminArticlesController {
  constructor(private readonly moderation: ArticleModerationService) {}

  @Roles(Role.ADMIN)
  @Get()
  queue(@Query(new ZodPipe(AdminArticleQueryDto)) query: AdminArticleQueryDtoType, @GetUser() user: AuthUser) {
    return this.moderation.queue(user, query);
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser) {
    return this.moderation.findOne(user, id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(OptionalNoteDto)) dto: OptionalNoteDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.moderation.approve(user, id, dto.note, traceId);
  }

  @Roles(Role.ADMIN)
  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(ReasonDto)) dto: ReasonDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.moderation.reject(user, id, dto.reason, traceId);
  }

  @Roles(Role.ADMIN)
  @Post(':id/suspend')
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(ReasonDto)) dto: ReasonDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.moderation.suspend(user, id, dto.reason, traceId);
  }

  @Roles(Role.ADMIN)
  @Post(':id/reinstate')
  reinstate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(OptionalNoteDto)) dto: OptionalNoteDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.moderation.reinstate(user, id, dto.note, traceId);
  }

  @Roles(Role.ADMIN)
  @Post(':id/archive')
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(OptionalNoteDto)) dto: OptionalNoteDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.moderation.archive(user, id, dto.note, traceId);
  }
}
