import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationsRepo } from './applications.repo';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { TenantsModule } from '@/v1/tenants/tenants.module';
import { CreatorEligibilityModule } from '../eligibility/creator-eligibility.module';
import { MasteryModule } from '@/v1/personalization/mastery/mastery.module';

@Module({
  imports:[PrismaModule, TenantsModule, CreatorEligibilityModule, MasteryModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationsRepo],
  exports:[ApplicationsService, ApplicationsRepo]
})
export class ApplicationsModule {}
