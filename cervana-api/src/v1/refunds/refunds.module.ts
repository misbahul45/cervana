import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { CommerceCoreModule } from '../commerce/commerce-core.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminRefundsController, OrderRefundsController, RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';

@Module({
  imports: [PrismaModule, CommerceCoreModule, OrdersModule, PaymentsModule, UploadsModule],
  controllers: [RefundsController, OrderRefundsController, AdminRefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
