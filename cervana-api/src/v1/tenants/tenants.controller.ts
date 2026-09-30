import { Body, Controller, Get, Patch } from '@nestjs/common';
import { TenantRole } from '@prisma/client';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AuthenticatedOnly } from '@/common/authz/access';
import { TraceId } from '@/common/authz/trace-id.decorator';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { CurrentTenant, TenantScoped } from '@/common/tenancy/tenant.guard';
import { TenantContext } from '@/common/tenancy/tenant-context';
import { GetUser } from '../auth/auth.decorator';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto, UpdateTenantType } from './tenants.dto';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @AuthenticatedOnly()
  @Get('mine')
  listMine(@GetUser() user: AuthUser) {
    return this.tenantsService.listMine(user);
  }

  @TenantScoped()
  @Get('current')
  getCurrent(@CurrentTenant() context: TenantContext) {
    return this.tenantsService.getCurrent(context);
  }

  @TenantScoped({ roles: [TenantRole.OWNER, TenantRole.MANAGER] })
  @Patch('current')
  updateCurrent(
    @Body(new ZodPipe(UpdateTenantDto)) dto: UpdateTenantType,
    @CurrentTenant() context: TenantContext,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.tenantsService.updateCurrent(user, context, dto, traceId);
  }
}
