import { Injectable, OnModuleInit } from '@nestjs/common';
import { Order, OrderStatus, Prisma } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { AuditService } from '@/common/authz/audit.service';
import { DomainEventBus, PublishedDomainEvent } from '@/common/events/domain-event-bus';
import { PaymentEvents, PaymentEventBase, PaymentFailedPayload } from '../payments/payment-events';
import { assertTransition } from './order-state';

export interface OrderTransitionContext {
  actorId?: string | null;
  actorRole?: import('@prisma/client').Role | null;
  action: string;
  reason?: string | null;
  traceId?: string | null;
  extra?: Prisma.OrderUpdateInput;
}

@Injectable()
export class OrderLifecycleService implements OnModuleInit {
  constructor(
    private readonly bus: DomainEventBus,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.bus.subscribe<PaymentFailedPayload>(PaymentEvents.Failed, 'order-lifecycle', (event, tx) =>
      this.applyPaymentOutcome(event, tx, OrderStatus.FAILED, 'ORDER_PAYMENT_FAILED'),
    );
    this.bus.subscribe<PaymentEventBase>(PaymentEvents.Expired, 'order-lifecycle', (event, tx) =>
      this.applyPaymentOutcome(event, tx, OrderStatus.EXPIRED, 'ORDER_EXPIRED'),
    );
    this.bus.subscribe<PaymentEventBase>(PaymentEvents.Cancelled, 'order-lifecycle', (event, tx) =>
      this.applyPaymentOutcome(event, tx, OrderStatus.CANCELLED, 'ORDER_CANCELLED'),
    );
  }

  async lock(tx: Prisma.TransactionClient, orderId: string): Promise<Order> {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new AppError('Order not found', 404, AppErrorCode.NOT_FOUND);
    }
    return order;
  }

  async transition(
    tx: Prisma.TransactionClient,
    orderId: string,
    target: OrderStatus,
    ctx: OrderTransitionContext,
  ): Promise<{ order: Order; changed: boolean }> {
    const order = await this.lock(tx, orderId);
    if (order.status === target) {
      return { order, changed: false };
    }
    assertTransition(order.status, target);

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: target, ...ctx.extra },
    });

    await this.audit.record(
      {
        actorId: ctx.actorId ?? null,
        actorRole: ctx.actorRole ?? null,
        action: ctx.action,
        entityType: 'Order',
        entityId: orderId,
        before: { status: order.status },
        after: { status: updated.status },
        reason: ctx.reason ?? null,
        traceId: ctx.traceId ?? null,
      },
      tx,
    );

    return { order: updated, changed: true };
  }

  markPaid(tx: Prisma.TransactionClient, orderId: string, paidAt: Date, ctx: Omit<OrderTransitionContext, 'action' | 'extra'>) {
    return this.transition(tx, orderId, OrderStatus.PAID, {
      ...ctx,
      action: 'ORDER_PAID',
      extra: { paidAt },
    });
  }

  markFulfilled(tx: Prisma.TransactionClient, orderId: string, ctx: Omit<OrderTransitionContext, 'action' | 'extra'>) {
    return this.transition(tx, orderId, OrderStatus.FULFILLED, { ...ctx, action: 'ORDER_FULFILLED' });
  }

  private async applyPaymentOutcome(
    event: PublishedDomainEvent<PaymentEventBase & { reason?: string | null }>,
    tx: Prisma.TransactionClient,
    target: OrderStatus,
    action: string,
  ) {
    await this.transition(tx, event.payload.orderId, target, {
      actorId: event.actorId,
      action,
      reason: event.payload.reason ?? null,
      traceId: event.traceId,
    });
  }
}
