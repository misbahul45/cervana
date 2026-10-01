import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { AdminEntitlementsController } from './admin-entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { TopicEntitlementBackfillService } from './topic-entitlement-backfill.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminEntitlementsController],
  providers: [TopicEntitlementBackfillService, EntitlementsService],
  exports: [TopicEntitlementBackfillService, EntitlementsService],
})
export class EntitlementsModule {}
