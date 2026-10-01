import { Injectable, OnModuleInit } from '@nestjs/common';
import { EarningStatus, LedgerCategory, LedgerDirection, OrderStatus, Prisma } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { AuditService } from '@/common/authz/audit.service';
import { DomainEventBus, PublishedDomainEvent } from '@/common/events/domain-event-bus';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../ledger/wallet.service';
import { OrderLifecycleService } from '../orders/order-lifecycle.service';
import { RefundEventPayload, RefundEvents } from '../payments/payment-events';
import { money } from './money';

@Injectable()
export class CommerceRefundService implements OnModuleInit {
  constructor(
    private readonly bus: DomainEventBus,
    private readonly lifecycle: OrderLifecycleService,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.bus.subscribe<RefundEventPayload>(RefundEvents.Completed, 'commerce-refund', (event, tx) =>
      this.reverse(event, tx),
    );
  }

  async reverse(event: PublishedDomainEvent<RefundEventPayload>, tx: Prisma.TransactionClient) {
    const { refundId, orderId, amount, currency } = event.payload;
    const ctx = { actorId: event.actorId, traceId: event.traceId };

    await this.lifecycle.transition(tx, orderId, OrderStatus.REFUNDED, { ...ctx, action: 'ORDER_REFUNDED' });

    await this.ledger.post(tx, {
      category: LedgerCategory.REFUND,
      direction: LedgerDirection.DEBIT,
      amount,
      currency,
      orderId,
      refundId,
      idempotencyKey: `refund:${refundId}`,
      description: 'Refund returned to the buyer',
      createdById: event.actorId,
      traceId: event.traceId,
    });

    const earnings = await tx.creatorEarning.findMany({ where: { orderId } });
    let reversedEntries = 0;
    for (const earning of earnings) {
      if (earning.status === EarningStatus.REVERSED) continue;

      const entries = await tx.ledgerTransaction.findMany({
        where: { earningId: earning.id, reversalOfId: null },
        orderBy: { createdAt: 'desc' },
      });
      const walletCredit = entries.find((entry) => entry.category === LedgerCategory.WALLET_CREDIT);
      if (walletCredit?.walletId) {
        const wallet = await this.wallets.lock(tx, walletCredit.walletId);
        if (money(wallet.balance).lessThan(money(walletCredit.amount))) {
          throw new AppError(
            'The creator has already withdrawn this earning; settle it before processing the refund',
            409,
            AppErrorCode.REFUND_EXCEEDS_BALANCE,
          );
        }
      }
      for (const entry of entries) {
        await this.ledger.reverse(tx, entry.id, {
          idempotencyKey: `refund-reversal:${refundId}:${entry.id}`,
          description: 'Earning reversed by a refund',
          createdById: event.actorId,
          traceId: event.traceId,
        });
        reversedEntries += 1;
      }
      await tx.creatorEarning.update({ where: { id: earning.id }, data: { status: EarningStatus.REVERSED } });
    }

    const items = await tx.orderItem.findMany({ where: { orderId }, select: { articleId: true, classId: true, topicId: true } });
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { userId: true } });
    const now = new Date();
    for (const item of items) {
      const target = item.articleId
        ? { articleId: item.articleId }
        : item.classId
          ? { classId: item.classId }
          : item.topicId
            ? { topicId: item.topicId }
            : null;
      if (!target) continue;
      await tx.entitlement.updateMany({
        where: { userId: order.userId, orderId, ...target, status: 'ACTIVE' },
        data: { status: 'REVOKED', expiresAt: now },
      });
      if (item.classId) {
        await tx.classEnrollment.updateMany({
          where: { classProductId: item.classId, userId: order.userId, orderId, status: 'ACTIVE' },
          data: { status: 'CANCELLED' },
        });
      }
      if (item.topicId) {
        await tx.userTopic.updateMany({
          where: { userId: order.userId, topicId: item.topicId, accessType: 'PURCHASED' },
          data: { expiredAt: now },
        });
      }
    }

    await this.audit.record(
      {
        actorId: event.actorId ?? null,
        action: 'REFUND_EFFECTS_APPLIED',
        entityType: 'Refund',
        entityId: refundId,
        after: { orderId, earningsReversed: earnings.length, ledgerEntriesReversed: reversedEntries },
        traceId: event.traceId ?? null,
      },
      tx,
    );
  }
}
