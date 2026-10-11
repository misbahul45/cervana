import { Module } from '@nestjs/common';
import { MarketplaceDiscoveryService } from './marketplace-discovery.service';
import { MarketplaceDiscoveryController } from './marketplace-discovery.controller';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { LearnerModelModule } from '@/v1/learner-model/learner-model.module';

@Module({
  imports: [LearnerModelModule],
  controllers: [MarketplaceDiscoveryController],
  providers: [MarketplaceDiscoveryService, PrismaService],
  exports: [MarketplaceDiscoveryService],
})
export class MarketplaceDiscoveryModule {}
