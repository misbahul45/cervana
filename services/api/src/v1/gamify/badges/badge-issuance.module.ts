import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { BadgeIssuanceController } from './badge-issuance.controller';
import { BadgeIssuanceRepo } from './badge-issuance.repo';
import { BadgeIssuanceService } from './badge-issuance.service';
import { AnalyticsModule } from '@/v1/analytics/analytics.module';

@Module({
  imports: [PrismaModule, AnalyticsModule],
  controllers: [BadgeIssuanceController],
  providers: [BadgeIssuanceService, BadgeIssuanceRepo],
  exports: [BadgeIssuanceService, BadgeIssuanceRepo],
})
export class BadgeIssuanceModule {}