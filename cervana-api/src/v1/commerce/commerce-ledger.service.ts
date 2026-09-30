import { Injectable } from '@nestjs/common';
import { CreatorEarning, LedgerCategory, Order, Prisma } from '@prisma/client';
import { money } from './money';

@Injectable()
export class CommerceLedgerService {
  async recordOrderPayment(
    tx: Prisma.TransactionClient,
    order: Pick<Order, 'id' | 'currency' | 'total'>,
    earnings: CreatorEarning[],
    paymentIntentId: string,
    createdById: string | null,
  ): Promise<number> {
    const entries: Prisma.LedgerTransactionCreateManyInput[] = [
      {
        category: LedgerCategory.ORDER_PAYMENT,
        amount: money(order.total ?? 0),
        currency: order.currency,
        orderId: order.id,
        idempotencyKey: `order-payment:${paymentIntentId}`,
        description: 'Verified order payment',
        createdById,
      },
    ];

    for (const earning of earnings) {
      const fee = money(earning.platformFee);
      const creatorAmount = money(earning.creatorAmount);
      if (fee.greaterThan(0)) {
        entries.push({
          category: LedgerCategory.PLATFORM_FEE,
          amount: fee,
          currency: earning.currency,
          orderId: order.id,
          earningId: earning.id,
          idempotencyKey: `platform-fee:${earning.orderItemId}`,
          description: 'Platform fee on order item',
          createdById,
        });
      }
      if (creatorAmount.greaterThan(0)) {
        entries.push({
          category: LedgerCategory.CREATOR_EARNING,
          amount: creatorAmount,
          currency: earning.currency,
          orderId: order.id,
          earningId: earning.id,
          idempotencyKey: `creator-earning:${earning.orderItemId}`,
          description: 'Creator earning on order item',
          createdById,
        });
      }
    }

    const inserted = await tx.ledgerTransaction.createMany({ data: entries, skipDuplicates: true });
    return inserted.count;
  }
}
