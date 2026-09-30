import { Injectable } from '@nestjs/common';
import {
  OrderStatus,
  PaymentIntent,
  PaymentIntentStatus,
  PaymentTransaction,
  PaymentTransactionStatus,
  PaymentTransactionType,
  Prisma,
} from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AuditService } from '@/common/authz/audit.service';
import { DomainEventBus } from '@/common/events/domain-event-bus';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { assertPaymentTransition, PAYMENT_OPEN_STATES } from './payment-state';
import {
  PAYMENT_AGGREGATE,
  PaymentEventBase,
  PaymentEvents,
  PaymentFailedPayload,
  PaymentVerifiedPayload,
  paymentEventKey,
} from './payment-events';
import {
  PaymentActorRef,
  PaymentPresentation,
  PaymentTransitionContext,
  VerifiedPaymentDraft,
} from './payment.types';

const PAID_LIKE: readonly PaymentIntentStatus[] = [
  PaymentIntentStatus.PAID,
  PaymentIntentStatus.REFUND_PENDING,
  PaymentIntentStatus.REFUNDED,
];

const ORDER_STATES_AFTER_PAYMENT: readonly OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.FULFILLED,
  OrderStatus.REFUND_PENDING,
  OrderStatus.REFUNDED,
];

export interface CreateIntentParams {
  order: { id: string };
  buyerId: string;
  amount: Prisma.Decimal;
  currency: string;
  expiresAt: Date;
  options?: Record<string, unknown>;
  actor: PaymentActorRef;
  traceId?: string;
}

export interface ReconciliationReport {
  paymentIntentId: string;
  status: PaymentIntentStatus;
  providerStatus: string | null;
  consistent: boolean;
  discrepancies: string[];
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PaymentProviderRegistry,
    private readonly bus: DomainEventBus,
    private readonly audit: AuditService,
  ) {}

  listMethods() {
    const adapter = this.registry.active();
    return { provider: adapter.provider, capabilities: adapter.capabilities, methods: adapter.listMethods() };
  }

  present(intent: PaymentIntent): PaymentPresentation {
    return this.registry.get(intent.provider).presentPayment(intent);
  }

  async createIntent(tx: Prisma.TransactionClient, params: CreateIntentParams): Promise<PaymentIntent> {
    const adapter = this.registry.active();
    const created = await adapter.createPaymentIntent(
      { tx, traceId: params.traceId },
      {
        orderId: params.order.id,
        buyerId: params.buyerId,
        amount: params.amount,
        currency: params.currency,
        expiresAt: params.expiresAt,
        options: params.options,
      },
    );

    const intent = await tx.paymentIntent.create({
      data: {
        orderId: params.order.id,
        provider: adapter.provider,
        providerPaymentId: created.providerPaymentId,
        amount: params.amount,
        currency: params.currency,
        status: PaymentIntentStatus.CREATED,
        expiresAt: params.expiresAt,
        metadata: created.metadata,
      },
    });

    await this.publish(tx, PaymentEvents.Created, intent, params.actor, params.traceId);

    return this.move(tx, intent, PaymentIntentStatus.PENDING, params.actor, 'PAYMENT_INTENT_CREATED', params);
  }

  async lockIntent(tx: Prisma.TransactionClient, intentId: string): Promise<PaymentIntent> {
    const ref = await tx.paymentIntent.findUnique({ where: { id: intentId }, select: { orderId: true } });
    if (!ref) {
      throw new AppError('Payment not found', 404, AppErrorCode.NOT_FOUND);
    }
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${ref.orderId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "PaymentIntent" WHERE id = ${intentId} FOR UPDATE`;
    return tx.paymentIntent.findUniqueOrThrow({ where: { id: intentId } });
  }

  async findLatestForOrder(
    client: Pick<Prisma.TransactionClient, 'paymentIntent'>,
    orderId: string,
  ): Promise<PaymentIntent | null> {
    return client.paymentIntent.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  }

  async markSubmitted(
    tx: Prisma.TransactionClient,
    intentId: string,
    submissionId: string,
    ctx: PaymentTransitionContext,
  ): Promise<PaymentIntent> {
    const intent = await this.lockIntent(tx, intentId);
    const moved = await this.move(tx, intent, PaymentIntentStatus.SUBMITTED, ctx.actor, 'PAYMENT_INTENT_SUBMITTED', ctx);
    await this.publish(tx, PaymentEvents.Submitted, moved, ctx.actor, ctx.traceId, submissionId);
    return moved;
  }

  async returnToPending(
    tx: Prisma.TransactionClient,
    intentId: string,
    ctx: PaymentTransitionContext,
  ): Promise<PaymentIntent> {
    const intent = await this.lockIntent(tx, intentId);
    return this.move(tx, intent, PaymentIntentStatus.PENDING, ctx.actor, 'PAYMENT_INTENT_RETURNED_TO_PENDING', ctx);
  }

  async markVerified(
    tx: Prisma.TransactionClient,
    intentId: string,
    draft: VerifiedPaymentDraft,
    ctx: PaymentTransitionContext,
  ): Promise<{ changed: boolean; intent: PaymentIntent; transaction: PaymentTransaction | null }> {
    const intent = await this.lockIntent(tx, intentId);

    if (PAID_LIKE.includes(intent.status)) {
      return { changed: false, intent, transaction: null };
    }
    assertPaymentTransition(intent.status, PaymentIntentStatus.PAID);

    const transaction = await tx.paymentTransaction.create({
      data: {
        paymentIntentId: intent.id,
        type: PaymentTransactionType.CAPTURE,
        amount: intent.amount,
        currency: intent.currency,
        externalReference: draft.externalReference,
        providerTransactionId: draft.providerTransactionId,
        status: PaymentTransactionStatus.SUCCEEDED,
        rawReference: draft.rawReference,
      },
    });

    const verifiedAt = new Date();
    const paid = await this.move(
      tx,
      intent,
      PaymentIntentStatus.PAID,
      ctx.actor,
      'PAYMENT_INTENT_VERIFIED',
      ctx,
      { paidAt: verifiedAt },
    );

    const payload: PaymentVerifiedPayload = {
      ...this.base(paid),
      transactionId: transaction.id,
      verifiedAt: verifiedAt.toISOString(),
      verifiedBy: { kind: ctx.actor.kind, id: ctx.actor.id },
    };
    await this.bus.publish(
      {
        type: PaymentEvents.Verified,
        aggregateType: PAYMENT_AGGREGATE,
        aggregateId: paid.id,
        dedupeKey: paymentEventKey(PaymentEvents.Verified, paid.id),
        payload,
        actorId: ctx.actor.id,
        traceId: ctx.traceId ?? null,
      },
      tx,
    );

    return { changed: true, intent: paid, transaction };
  }

  async markFailed(
    tx: Prisma.TransactionClient,
    intentId: string,
    ctx: PaymentTransitionContext,
  ): Promise<{ changed: boolean; intent: PaymentIntent }> {
    const intent = await this.lockIntent(tx, intentId);
    if (intent.status === PaymentIntentStatus.FAILED) {
      return { changed: false, intent };
    }
    const failed = await this.move(tx, intent, PaymentIntentStatus.FAILED, ctx.actor, 'PAYMENT_INTENT_FAILED', ctx);
    const payload: PaymentFailedPayload = { ...this.base(failed), reason: ctx.reason ?? null };
    await this.bus.publish(
      {
        type: PaymentEvents.Failed,
        aggregateType: PAYMENT_AGGREGATE,
        aggregateId: failed.id,
        dedupeKey: paymentEventKey(PaymentEvents.Failed, failed.id),
        payload,
        actorId: ctx.actor.id,
        traceId: ctx.traceId ?? null,
      },
      tx,
    );
    return { changed: true, intent: failed };
  }

  async cancelForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    ctx: PaymentTransitionContext,
  ): Promise<PaymentIntent | null> {
    const live = await tx.paymentIntent.findFirst({
      where: { orderId, status: { in: [...PAYMENT_OPEN_STATES] } },
      select: { id: true },
    });
    if (!live) {
      return null;
    }

    const intent = await this.lockIntent(tx, live.id);
    const decision = await this.registry.get(intent.provider).cancelPayment({ tx, traceId: ctx.traceId }, intent);
    if (!decision.allowed) {
      throw new AppError(
        decision.reason ?? 'Payment cannot be cancelled',
        409,
        AppErrorCode.INVALID_STATE_TRANSITION,
      );
    }

    const cancelled = await this.move(tx, intent, PaymentIntentStatus.CANCELLED, ctx.actor, 'PAYMENT_INTENT_CANCELLED', ctx);
    await this.publish(tx, PaymentEvents.Cancelled, cancelled, ctx.actor, ctx.traceId);
    return cancelled;
  }

  async expireIfDue(intentId: string, now: Date = new Date()): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const intent = await this.lockIntent(tx, intentId);
      const expirable: PaymentIntentStatus[] = [PaymentIntentStatus.CREATED, PaymentIntentStatus.PENDING];
      if (!expirable.includes(intent.status) || intent.expiresAt.getTime() > now.getTime()) {
        return false;
      }
      const actor: PaymentActorRef = { kind: 'SYSTEM', id: null };
      const expired = await this.move(tx, intent, PaymentIntentStatus.EXPIRED, actor, 'PAYMENT_INTENT_EXPIRED', {});
      await this.publish(tx, PaymentEvents.Expired, expired, actor);
      return true;
    });
  }

  async expireDue(limit = 100, now: Date = new Date()): Promise<number> {
    const due = await this.prisma.paymentIntent.findMany({
      where: {
        status: { in: [PaymentIntentStatus.CREATED, PaymentIntentStatus.PENDING] },
        expiresAt: { lte: now },
      },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });
    let expired = 0;
    for (const { id } of due) {
      if (await this.expireIfDue(id, now)) {
        expired += 1;
      }
    }
    return expired;
  }

  async reconcile(intentId: string, ctx: PaymentTransitionContext): Promise<ReconciliationReport> {
    return this.prisma.$transaction(async (tx) => {
      const intent = await this.lockIntent(tx, intentId);
      const adapter = this.registry.get(intent.provider);
      const result = await adapter.reconcilePayment({ tx, traceId: ctx.traceId }, intent);
      const discrepancies = [...result.discrepancies];

      const order = await tx.order.findUnique({ where: { id: intent.orderId }, select: { status: true } });
      if (!order) {
        discrepancies.push('Order is missing');
      } else if (intent.status === PaymentIntentStatus.PAID && !ORDER_STATES_AFTER_PAYMENT.includes(order.status)) {
        discrepancies.push(`Payment is paid but the order is ${order.status}`);
      } else if (
        (intent.status === PaymentIntentStatus.FAILED ||
          intent.status === PaymentIntentStatus.EXPIRED ||
          intent.status === PaymentIntentStatus.CANCELLED) &&
        order.status === OrderStatus.PENDING
      ) {
        discrepancies.push(`Payment is ${intent.status} but the order is still pending`);
      }

      const report: ReconciliationReport = {
        paymentIntentId: intent.id,
        status: intent.status,
        providerStatus: result.providerStatus,
        consistent: discrepancies.length === 0,
        discrepancies,
      };

      await this.audit.record(
        {
          actorId: ctx.actor.id,
          actorRole: ctx.actor.role ?? null,
          action: 'PAYMENT_RECONCILED',
          entityType: 'PaymentIntent',
          entityId: intent.id,
          after: { consistent: report.consistent, discrepancies },
          reason: ctx.reason,
          traceId: ctx.traceId,
        },
        tx,
      );

      return report;
    });
  }

  private base(intent: PaymentIntent): PaymentEventBase {
    return {
      paymentIntentId: intent.id,
      orderId: intent.orderId,
      provider: intent.provider,
      amount: intent.amount.toString(),
      currency: intent.currency,
    };
  }

  private async publish(
    tx: Prisma.TransactionClient,
    type: string,
    intent: PaymentIntent,
    actor: PaymentActorRef,
    traceId?: string,
    discriminator?: string,
  ) {
    return this.bus.publish(
      {
        type,
        aggregateType: PAYMENT_AGGREGATE,
        aggregateId: intent.id,
        dedupeKey: paymentEventKey(type, intent.id, discriminator),
        payload: this.base(intent),
        actorId: actor.id,
        traceId: traceId ?? null,
      },
      tx,
    );
  }

  private async move(
    tx: Prisma.TransactionClient,
    intent: PaymentIntent,
    to: PaymentIntentStatus,
    actor: PaymentActorRef,
    action: string,
    ctx: { reason?: string; traceId?: string },
    extra: Prisma.PaymentIntentUpdateInput = {},
  ): Promise<PaymentIntent> {
    assertPaymentTransition(intent.status, to);
    const updated = await tx.paymentIntent.update({
      where: { id: intent.id },
      data: { status: to, ...extra },
    });
    await this.audit.record(
      {
        actorId: actor.id,
        actorRole: actor.role ?? null,
        action,
        entityType: 'PaymentIntent',
        entityId: intent.id,
        before: { status: intent.status },
        after: { status: updated.status },
        reason: ctx.reason,
        traceId: ctx.traceId,
      },
      tx,
    );
    return updated;
  }
}
