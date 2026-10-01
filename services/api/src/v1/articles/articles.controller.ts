import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { TenantRole } from '@prisma/client';
import { TraceId } from '@/common/authz/trace-id.decorator';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { CurrentTenant, TenantScoped } from '@/common/tenancy/tenant.guard';
import { TenantContext } from '@/common/tenancy/tenant-context';
import { GetUser } from '../auth/auth.decorator';
import { ArticleAuthoringService } from './article-authoring.service';
import {
  CreateArticleDto,
  CreateArticleDtoType,
  TeacherArticleQueryDto,
  TeacherArticleQueryDtoType,
  UpdateArticleDto,
  UpdateArticleDtoType,
} from './articles.dto';

const TENANT_MEMBERS = [TenantRole.OWNER, TenantRole.MANAGER, TenantRole.TEACHER, TenantRole.EDITOR] as const;

@Controller('articles')
@TenantScoped({ roles: TENANT_MEMBERS })
export class ArticlesController {
  constructor(private readonly authoring: ArticleAuthoringService) {}

  @Post()
  create(
    @Body(new ZodPipe(CreateArticleDto)) dto: CreateArticleDtoType,
    @CurrentTenant() context: TenantContext,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.authoring.create(user, context, dto, traceId);
  }

  @Get()
  list(
    @Query(new ZodPipe(TeacherArticleQueryDto)) query: TeacherArticleQueryDtoType,
    @CurrentTenant() context: TenantContext,
    @GetUser() user: AuthUser,
  ) {
    return this.authoring.list(user, context, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() context: TenantContext, @GetUser() user: AuthUser) {
    return this.authoring.findOne(user, context, id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(UpdateArticleDto)) dto: UpdateArticleDtoType,
    @CurrentTenant() context: TenantContext,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.authoring.update(user, context, id, dto, traceId);
  }

  @Post(':id/submit-review')
  submitReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() context: TenantContext,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.authoring.submitReview(user, context, id, traceId);
  }

  @Post(':id/withdraw')
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() context: TenantContext,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.authoring.withdraw(user, context, id, traceId);
  }

  @Post(':id/archive')
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() context: TenantContext,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.authoring.archive(user, context, id, traceId);
  }
}
