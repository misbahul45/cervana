import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { OrdersModule } from '../orders/orders.module';
import { CommerceLedgerService } from './commerce-ledger.service';
import { CommerceCoreModule } from './commerce-core.module';
import { CreatorEarningsService } from './creator-earnings.service';
import { CommerceFulfillmentService } from './fulfillment/commerce-fulfillment.service';

@Module({
  imports: [CommerceCoreModule, OrdersModule, EntitlementsModule],
  providers: [CreatorEarningsService, CommerceLedgerService, CommerceFulfillmentService],
  exports: [CreatorEarningsService, CommerceLedgerService],
})
export class CommerceModule {}
