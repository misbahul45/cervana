import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class ReservationCommitService {
  constructor(private readonly prisma: PrismaService) {}

  async commit(reservationId: string, reason: string, referenceId: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new NotFoundException('reservation_not_found');
    if (reservation.status !== 'PENDING') return { deduplicated: true };

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'COMMITTED', committedAt: new Date() },
    });

    await this.prisma.wallet.update({
      where: { id: reservation.walletId },
      data: { balance: { increment: reservation.amount } },
    });

    await this.prisma.ledgerTransaction.create({
      data: {
        category: 'PURCHASE' as any,
        direction: 'CREDIT' as any,
        amount: reservation.amount,
        currency: reservation.currency,
        walletId: reservation.walletId,
        referenceId,
        idempotencyKey: `${reservationId}-commit`,
      } as any,
    });

    return { deduplicated: false, reason, referenceId };
  }

  async release(reservationId: string, _reason: string) {
    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
  }
}