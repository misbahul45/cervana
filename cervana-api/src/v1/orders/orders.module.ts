import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { CommerceCoreModule } from '../commerce/commerce-core.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrderCatalogService } from './order-catalog.service';
import { OrderLifecycleService } from './order-lifecycle.service';
import { OrdersController } from './orders.controller';
import { OrdersRepo } from './orders.repo';
import { OrdersService } from './orders.service';

@Module({
  imports: [PrismaModule, PaymentsModule, CommerceCoreModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepo, OrderCatalogService, OrderLifecycleService],
  exports: [OrderLifecycleService],
})
export class OrdersModule {}
