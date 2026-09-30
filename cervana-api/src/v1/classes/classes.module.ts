import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminClassesController } from './admin-classes.controller';
import { ClassAuthoringService } from './class-authoring.service';
import { ClassEnrollmentsService } from './class-enrollments.service';
import { ClassModerationService } from './class-moderation.service';
import { ClassesController } from './classes.controller';
import { MarketplaceClassesController } from './marketplace-classes.controller';
import { MarketplaceClassesService } from './marketplace-classes.service';

@Module({
  imports: [PrismaModule, UploadsModule, TenantsModule, EntitlementsModule],
  controllers: [ClassesController, MarketplaceClassesController, AdminClassesController],
  providers: [ClassAuthoringService, ClassModerationService, MarketplaceClassesService, ClassEnrollmentsService],
  exports: [ClassEnrollmentsService],
})
export class ClassesModule {}
