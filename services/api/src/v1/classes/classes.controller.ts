import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { TenantRole } from '@prisma/client';
import { TraceId } from '@/common/authz/trace-id.decorator';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { CurrentTenant, TenantScoped } from '@/common/tenancy/tenant.guard';
import { TenantContext } from '@/common/tenancy/tenant-context';
import { GetUser } from '../auth/auth.decorator';
import { ClassAuthoringService } from './class-authoring.service';
import {
  CreateClassDto,
  CreateClassDtoType,
  CreateSessionDto,
  CreateSessionDtoType,
  EnrollmentListQueryDto,
  EnrollmentListQueryDtoType,
  TeacherClassQueryDto,
  TeacherClassQueryDtoType,
  UpdateClassDto,
  UpdateClassDtoType,
  UpdateSessionDto,
  UpdateSessionDtoType,
} from './classes.dto';

const TENANT_MEMBERS = [TenantRole.OWNER, TenantRole.MANAGER, TenantRole.TEACHER, TenantRole.EDITOR] as const;

@Controller('classes')
@TenantScoped({ roles: TENANT_MEMBERS })
export class ClassesController {
  constructor(private readonly authoring: ClassAuthoringService) {}

  @Post()
  create(
    @Body(new ZodPipe(CreateClassDto)) dto: CreateClassDtoType,
    @CurrentTenant() context: TenantContext,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.authoring.create(user, context, dto, traceId);
  }

  @Get()
  list(
    @Query(new ZodPipe(TeacherClassQueryDto)) query: TeacherClassQueryDtoType,
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
    @Body(new ZodPipe(UpdateClassDto)) dto: UpdateClassDtoType,
    @CurrentTenant() context: TenantContext,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.authoring.update(user, context, id, dto, traceId);
  }

  @Post(':id/submit-review')
  submitReview(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() context: TenantContext, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.authoring.submitReview(user, context, id, traceId);
  }

  @Post(':id/withdraw')
  withdraw(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() context: TenantContext, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.authoring.withdraw(user, context, id, traceId);
  }

  @Post(':id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() context: TenantContext, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.authoring.archive(user, context, id, traceId);
  }

  @Post(':id/sessions')
  addSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(CreateSessionDto)) dto: CreateSessionDtoType,
    @CurrentTenant() context: TenantContext,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.authoring.addSession(user, context, id, dto, traceId);
  }

  @Patch(':id/sessions/:sessionId')
  updateSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body(new ZodPipe(UpdateSessionDto)) dto: UpdateSessionDtoType,
    @CurrentTenant() context: TenantContext,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.authoring.updateSession(user, context, id, sessionId, dto, traceId);
  }

  @Post(':id/sessions/:sessionId/cancel')
  cancelSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentTenant() context: TenantContext,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.authoring.cancelSession(user, context, id, sessionId, traceId);
  }

  @Get(':id/enrollments')
  enrollments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodPipe(EnrollmentListQueryDto)) query: EnrollmentListQueryDtoType,
    @CurrentTenant() context: TenantContext,
    @GetUser() user: AuthUser,
  ) {
    return this.authoring.enrollments(user, context, id, query);
  }
}
