import { Injectable, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { EventLogService } from '@/v1/analytics/events/event-log.service';

const HOLD_DAYS = 7;

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly events?: EventLogService,
  ) {}

  async requestWithdrawal(input: {
    creatorId: string;
    walletId: string;
    amount: number;
    idempotencyKey?: string;
  }) {
    if (input.amount <= 0) throw new BadRequestException('amount_must_be_positive');

    if (input.idempotencyKey) {
      const recent = await this.prisma.payoutRequest.findFirst({
        where: {
          creatorId: input.creatorId,
          walletId: input.walletId,
          amount: input.amount,
          status: 'REQUESTED' as any,
          requestedAt: { gte: new Date(Date.now() - 5 * 60_000) },
        },
      });
      if (recent) return { payout: recent, deduplicated: true };
    }

    const payout = await this.prisma.payoutRequest.create({
      data: {
        creatorId: input.creatorId,
        walletId: input.walletId,
        amount: input.amount,
        currency: 'IDR',
        status: 'REQUESTED' as any,
      } as any,
    });

    const releaseAt = new Date(Date.now() + HOLD_DAYS * 86_400_000);
    await this.prisma.holdWindow.create({
      data: { payoutId: payout.id, releaseAt },
    });

    return { payout, deduplicated: false };
  }

  async releaseDuePayouts() {
    const due = await this.prisma.holdWindow.findMany({
      where: { released: false, releaseAt: { lte: new Date() } },
      include: { payout: true },
    });
    let count = 0;
    for (const hw of due) {
      await this.releasePayout(hw.payoutId);
      count += 1;
    }
    return count;
  }

  async releasePayout(payoutId: string) {
    const hw = await this.prisma.holdWindow.findUnique({ where: { payoutId } });
    if (!hw || hw.released) return;

    const payout = await this.prisma.payoutRequest.findUnique({ where: { id: payoutId } });
    if (!payout) return;

    await this.prisma.holdWindow.update({
      where: { payoutId },
      data: { released: true, releasedAt: new Date() },
    });

    await this.prisma.payoutRequest.update({
      where: { id: payoutId },
      data: { status: 'RELEASED' as any },
    });

    await this.prisma.ledgerTransaction.create({
      data: {
        category: 'PAYOUT' as any,
        direction: 'DEBIT' as any,
        amount: payout.amount,
        currency: 'IDR',
        walletId: payout.walletId,
        idempotencyKey: `payout-${payoutId}-release`,
      } as any,
    });

    if (this.events) {
      await this.events.record({
        userId: payout.creatorId,
        action: 'PAYOUT_RELEASED',
        entityId: payoutId,
        metadata: { amount: Number(payout.amount), currency: 'IDR' },
      });
    }
  }

  listByUser(creatorId: string) {
    return this.prisma.payoutRequest.findMany({
      where: { creatorId },
      orderBy: { requestedAt: 'desc' },
    });
  }
}