import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

    const existing = await this.prisma.reservation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      return {
        orderId: null,
        reservationId: existing.id,
        expiresAt: existing.expiresAt,
        deduplicated: true,
      };
    }

    const pkg = await this.prisma.creditPackage.findUnique({ where: { slug: input.slug } });
    if (!pkg || !pkg.isActive) throw new NotFoundException('package_not_found');

    const order = await this.prisma.order.create({
      data: {
        userId: input.userId,
        total: pkg.priceAmount,
        subtotal: pkg.priceAmount,
        currency: pkg.priceCurrency,
        creditPackageId: pkg.id,
        status: 'PENDING' as any,
      } as any,
    });

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);
    const reservation = await this.prisma.reservation.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
        walletId: input.walletId,
        amount: pkg.creditAmount,
        currency: pkg.priceCurrency,
        purpose: 'PURCHASE_CREDITS',
        referenceId: order.id,
        status: 'PENDING',
        expiresAt,
      },
    });

    return {
      orderId: order.id,
      reservationId: reservation.id,
      expiresAt,
      deduplicated: false,
    };
  }
}