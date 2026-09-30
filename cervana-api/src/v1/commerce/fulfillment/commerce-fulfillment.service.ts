import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '@/common/authz/audit.service';
import { DomainEventBus, PublishedDomainEvent } from '@/common/events/domain-event-bus';
import { EntitlementsService } from '../../entitlements/entitlements.service';
import { OrderLifecycleService } from '../../orders/order-lifecycle.service';
import { PaymentEvents, PaymentVerifiedPayload } from '../../payments/payment-events';
import { CommerceLedgerService } from '../commerce-ledger.service';
import { CreatorEarningsService } from '../creator-earnings.service';

@Injectable()
export class CommerceFulfillmentService implements OnModuleInit {
  constructor(
    private readonly bus: DomainEventBus,
    private readonly lifecycle: OrderLifecycleService,
    private readonly entitlements: EntitlementsService,
    private readonly earnings: CreatorEarningsService,
    private readonly ledger: CommerceLedgerService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.bus.subscribe<PaymentVerifiedPayload>(PaymentEvents.Verified, 'commerce-fulfillment', (event, tx) =>
      this.fulfill(event, tx),
    );
  }

  async fulfill(event: PublishedDomainEvent<PaymentVerifiedPayload>, tx: Prisma.TransactionClient) {
    const payload = event.payload;
    const paidAt = new Date(payload.verifiedAt);
    const ctx = { actorId: event.actorId, traceId: event.traceId };

    await this.lifecycle.markPaid(tx, payload.orderId, paidAt, ctx);

    const order = await tx.order.findUniqueOrThrow({
      where: { id: payload.orderId },
      include: { items: true },
    });

    const granted = await this.entitlements.grantForOrder(tx, order, order.items, paidAt);
    const earnings = await this.earnings.recordForOrder(tx, order, order.items);
    const ledgerEntries = await this.ledger.recordOrderPayment(
      tx,
      order,
      earnings,
      payload.paymentIntentId,
      event.actorId ?? null,
    );

    await this.lifecycle.markFulfilled(tx, order.id, ctx);

    await this.audit.record(
      {
        actorId: event.actorId ?? null,
        action: 'ORDER_FULFILLMENT_COMPLETED',
        entityType: 'Order',
        entityId: order.id,
        after: {
          paymentIntentId: payload.paymentIntentId,
          entitlements: granted,
          earnings: earnings.length,
          ledgerEntries,
        },
        traceId: event.traceId ?? null,
      },
      tx,
    );
  }
}
