import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { TraceId } from '@/common/authz/trace-id.decorator';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { GetUser, Roles } from '../auth/auth.decorator';
import { TenantsService } from './tenants.service';
import {
  TenantListQueryDto,
  TenantListQueryType,
  TenantReasonDto,
  TenantReasonType,
} from './tenants.dto';

@Controller('admin/tenants')
export class AdminTenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Roles(Role.ADMIN)
  @Get()
  list(@Query(new ZodPipe(TenantListQueryDto)) query: TenantListQueryType, @GetUser() user: AuthUser) {
    return this.tenantsService.listAll(user, query);
  }

  @Roles(Role.ADMIN)
  @Post(':id/suspend')
  suspend(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(TenantReasonDto)) dto: TenantReasonType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.tenantsService.suspend(user, id, dto.reason, traceId);
  }

  @Roles(Role.ADMIN)
  @Post(':id/activate')
  activate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(TenantReasonDto)) dto: TenantReasonType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.tenantsService.activate(user, id, dto.reason, traceId);
  }
}
