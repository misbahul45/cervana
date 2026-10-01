import { Injectable } from '@nestjs/common';
import { CreatorEarning, LedgerCategory, LedgerDirection, Order, Prisma } from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';
import { money } from './money';

@Injectable()
export class CommerceLedgerService {
  constructor(private readonly ledger: LedgerService) {}

  async recordOrderPayment(
    tx: Prisma.TransactionClient,
    order: Pick<Order, 'id' | 'currency' | 'total'>,
    earnings: CreatorEarning[],
    paymentIntentId: string,
    createdById: string | null,
    traceId?: string | null,
  ): Promise<number> {
    let created = 0;
    const post = async (input: Parameters<LedgerService['post']>[1]) => {
      const result = await this.ledger.post(tx, { ...input, createdById, traceId });
      if (result.created) created += 1;
    };

    await post({
      category: LedgerCategory.ORDER_PAYMENT,
      direction: LedgerDirection.CREDIT,
      amount: money(order.total),
      currency: order.currency,
      orderId: order.id,
      idempotencyKey: `order-payment:${paymentIntentId}`,
      description: 'Verified order payment',
    });

    for (const earning of earnings) {
      const fee = money(earning.platformFee);
      const creatorAmount = money(earning.creatorAmount);
      if (fee.greaterThan(0)) {
        await post({
          category: LedgerCategory.PLATFORM_FEE,
          direction: LedgerDirection.CREDIT,
          amount: fee,
          currency: earning.currency,
          orderId: order.id,
          earningId: earning.id,
          idempotencyKey: `platform-fee:${earning.orderItemId}`,
          description: 'Platform fee on order item',
        });
      }
      if (creatorAmount.greaterThan(0)) {
        await post({
          category: LedgerCategory.CREATOR_EARNING,
          direction: LedgerDirection.CREDIT,
          amount: creatorAmount,
          currency: earning.currency,
          orderId: order.id,
          earningId: earning.id,
          idempotencyKey: `creator-earning:${earning.orderItemId}`,
          description: 'Creator earning accrued on order item',
        });
      }
    }

    return created;
  }
}
