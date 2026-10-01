import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AuthenticatedOnly } from '@/common/authz/access';
import { TraceId } from '@/common/authz/trace-id.decorator';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { RequireOwnership } from '@/v1/common/guards/ownership.decorator';
import { ApplicationsService } from './applications.service';
import {
  ApplicationListQueryDto,
  ApplicationListQueryType,
  ApproveApplicationDto,
  ApproveApplicationType,
  RejectApplicationDto,
  RejectApplicationType,
  SubmitApplicationDto,
  SubmitApplicationType,
  UpdateApplicationDto,
  UpdateApplicationType,
} from './applications.dto';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @AuthenticatedOnly()
  @Post()
  submit(
    @Body(new ZodPipe(SubmitApplicationDto)) dto: SubmitApplicationType,
    @GetUser() user: AuthUser,
  ) {
    return this.applicationsService.submit(user, dto);
  }

  @AuthenticatedOnly()
  @Get()
  findAll(
    @Query(new ZodPipe(ApplicationListQueryDto)) query: ApplicationListQueryType,
    @GetUser() user: AuthUser,
  ) {
    return this.applicationsService.findAll(user, query);
  }

  @RequireOwnership('teacher-application')
  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: AuthUser) {
    return this.applicationsService.findOne(user, id);
  }

  @RequireOwnership('teacher-application')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateApplicationDto)) dto: UpdateApplicationType,
    @GetUser() user: AuthUser,
  ) {
    return this.applicationsService.update(user, id, dto);
  }

  @Roles(Role.ADMIN)
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body(new ZodPipe(ApproveApplicationDto)) dto: ApproveApplicationType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.applicationsService.approve(user, id, dto.feedback, traceId);
  }

  @Roles(Role.ADMIN)
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body(new ZodPipe(RejectApplicationDto)) dto: RejectApplicationType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.applicationsService.reject(user, id, dto.feedback, traceId);
  }
}
