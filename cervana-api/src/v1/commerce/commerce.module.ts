import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { LedgerModule } from '../ledger/ledger.module';
import { OrdersModule } from '../orders/orders.module';
import { CommerceLedgerService } from './commerce-ledger.service';
import { CommerceRefundService } from './commerce-refund.service';
import { CommerceCoreModule } from './commerce-core.module';
import { CreatorEarningsService } from './creator-earnings.service';
import { CommerceFulfillmentService } from './fulfillment/commerce-fulfillment.service';

@Module({
  imports: [CommerceCoreModule, OrdersModule, EntitlementsModule, LedgerModule, ClassesModule],
  providers: [CreatorEarningsService, CommerceLedgerService, CommerceFulfillmentService, CommerceRefundService],
  exports: [CreatorEarningsService, CommerceLedgerService],
})
export class CommerceModule {}
