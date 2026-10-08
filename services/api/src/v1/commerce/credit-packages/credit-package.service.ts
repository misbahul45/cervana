import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

const RESERVATION_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class CreditPackageService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async purchase(input: {
    userId: string;
    slug: string;
    idempotencyKey: string;
    walletId: string;
  }) {
    if (!input.idempotencyKey) throw new BadRequestException('idempotency_key_required');

    const replay = await this.replayFor(input.userId, input.idempotencyKey);
    if (replay) return replay;

    const pkg = await this.prisma.creditPackage.findUnique({ where: { slug: input.slug } });
    if (!pkg || !pkg.isActive) throw new NotFoundException('package_not_found');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            userId: input.userId,
            total: pkg.priceAmount,
            subtotal: pkg.priceAmount,
            currency: pkg.priceCurrency,
            creditPackageId: pkg.id,
            status: 'PENDING' as any,
          } as any,
        });

        const reservation = await tx.reservation.create({
          data: {
            idempotencyKey: input.idempotencyKey,
            userId: input.userId,
            walletId: input.walletId,
            amount: pkg.creditAmount,
            currency: pkg.priceCurrency,
            purpose: 'PURCHASE_CREDITS',
            referenceId: order.id,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          },
        });

        return {
          orderId: order.id,
          reservationId: reservation.id,
          expiresAt: reservation.expiresAt,
          deduplicated: false,
        };
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        const raced = await this.replayFor(input.userId, input.idempotencyKey);
        if (raced) return raced;
      }
      throw error;
    }
  }

  private async replayFor(userId: string, idempotencyKey: string) {
    const existing = await this.prisma.reservation.findUnique({ where: { idempotencyKey } });
    if (!existing) return null;
    if (existing.userId !== userId) throw new ConflictException('idempotency_key_conflict');
    return {
      orderId: existing.referenceId,
      reservationId: existing.id,
      expiresAt: existing.expiresAt,
      deduplicated: true,
    };
  }
}
