import { Module } from '@nestjs/common';
import { MarketplaceDiscoveryService } from './marketplace-discovery.service';
import { MarketplaceDiscoveryController } from './marketplace-discovery.controller';
import { MasteryService } from '../learner-model/services/mastery.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Module({
  controllers: [MarketplaceDiscoveryController],
  providers: [MarketplaceDiscoveryService, MasteryService, PrismaService],
  exports: [MarketplaceDiscoveryService],
})
export class MarketplaceDiscoveryModule {}
