import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '@/common/authz/audit.service';
import { DomainEventBus, PublishedDomainEvent } from '@/common/events/domain-event-bus';
import { ClassEnrollmentsService } from '../../classes/class-enrollments.service';
import { EntitlementsService } from '../../entitlements/entitlements.service';
import { OrderLifecycleService } from '../../orders/order-lifecycle.service';
import { PaymentEvents, PaymentVerifiedPayload } from '../../payments/payment-events';
import {
  CommerceEvents,
  CreatorEarningCreatedPayload,
  EARNING_AGGREGATE,
  ENTITLEMENT_AGGREGATE,
  EntitlementGrantedPayload,
  ORDER_AGGREGATE,
  OrderFulfilledPayload,
} from '../commerce-events';
import { CommerceConfig } from '../commerce.config';
import { CommerceLedgerService } from '../commerce-ledger.service';
import { CreatorEarningsService } from '../creator-earnings.service';
import { EventLogService } from '@/v1/analytics/events/event-log.service';

@Injectable()
export class CommerceFulfillmentService implements OnModuleInit {
  constructor(
    private readonly bus: DomainEventBus,
    private readonly lifecycle: OrderLifecycleService,
    private readonly entitlements: EntitlementsService,
    private readonly earnings: CreatorEarningsService,
    private readonly ledger: CommerceLedgerService,
    private readonly audit: AuditService,
    private readonly config: CommerceConfig,
    private readonly classEnrollments: ClassEnrollmentsService,
    private readonly events?: EventLogService,
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

    await this.classEnrollments.enrollForOrder(tx, order, order.items, event.traceId);
    const granted = await this.entitlements.grantForOrder(tx, order, order.items, paidAt);
    const earnings = await this.earnings.recordForOrder(tx, order, order.items);
    const ledgerEntries = await this.ledger.recordOrderPayment(
      tx,
      order,
      earnings,
      payload.paymentIntentId,
      event.actorId ?? null,
      event.traceId ?? null,
    );

    let released = 0;
    if (this.config.earningHoldDays === 0) {
      for (const earning of earnings) {
        const outcome = await this.earnings.release(tx, earning, ctx);
        if (outcome.released) released += 1;
      }
    }

    await this.lifecycle.markFulfilled(tx, order.id, ctx);

    if (this.events) {
      await this.events.record({
        userId: order.userId,
        action: 'PURCHASE_COMPLETED',
        entityId: order.id,
        metadata: { total: Number(order.total), currency: order.currency },
      });
    }

    for (const item of granted) {
      const body: EntitlementGrantedPayload = {
        orderId: order.id,
        userId: order.userId,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
      };
      await this.bus.publish(
        {
          type: CommerceEvents.EntitlementGranted,
          aggregateType: ENTITLEMENT_AGGREGATE,
          aggregateId: `${order.userId}:${item.resourceType}:${item.resourceId}`,
          dedupeKey: `${CommerceEvents.EntitlementGranted}:${order.id}:${item.resourceType}:${item.resourceId}`,
          payload: body,
          actorId: event.actorId,
          traceId: event.traceId,
        },
        tx,
      );
    }

    for (const earning of earnings) {
      const body: CreatorEarningCreatedPayload = {
        earningId: earning.id,
        orderId: order.id,
        tenantId: earning.tenantId,
        creatorId: earning.creatorId,
        grossAmount: earning.grossAmount.toString(),
        platformFee: earning.platformFee.toString(),
        creatorAmount: earning.creatorAmount.toString(),
        currency: earning.currency,
      };
      await this.bus.publish(
        {
          type: CommerceEvents.CreatorEarningCreated,
          aggregateType: EARNING_AGGREGATE,
          aggregateId: earning.id,
          dedupeKey: `${CommerceEvents.CreatorEarningCreated}:${earning.id}`,
          payload: body,
          tenantId: earning.tenantId,
          actorId: event.actorId,
          traceId: event.traceId,
        },
        tx,
      );
    }

    const fulfilled: OrderFulfilledPayload = {
      orderId: order.id,
      paymentIntentId: payload.paymentIntentId,
      userId: order.userId,
      total: order.total.toString(),
      currency: order.currency,
      itemCount: order.items.length,
    };
    await this.bus.publish(
      {
        type: CommerceEvents.OrderFulfilled,
        aggregateType: ORDER_AGGREGATE,
        aggregateId: order.id,
        dedupeKey: `${CommerceEvents.OrderFulfilled}:${order.id}`,
        payload: fulfilled,
        actorId: event.actorId,
        traceId: event.traceId,
      },
      tx,
    );

    await this.audit.record(
      {
        actorId: event.actorId ?? null,
        action: 'ORDER_FULFILLMENT_COMPLETED',
        entityType: 'Order',
        entityId: order.id,
        after: {
          paymentIntentId: payload.paymentIntentId,
          entitlements: granted.length,
          earnings: earnings.length,
          ledgerEntries,
          released,
        },
        traceId: event.traceId ?? null,
      },
      tx,
    );
  }
}
