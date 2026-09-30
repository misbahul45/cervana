import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { TenantContextService } from '@/common/tenancy/tenant-context.service';
import { TenantGuard } from '@/common/tenancy/tenant.guard';
import { TenantsController } from './tenants.controller';
import { AdminTenantsController } from './admin-tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantProvisioningService } from './tenant-provisioning.service';

@Module({
  imports: [PrismaModule],
  controllers: [TenantsController, AdminTenantsController],
  providers: [TenantContextService, TenantGuard, TenantsService, TenantProvisioningService],
  exports: [TenantContextService, TenantGuard, TenantProvisioningService],
})
export class TenantsModule {}
