import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class StudioEarningsService {
  constructor(private readonly prisma: PrismaService) {}

  async summarize(creatorId: string) {
    const earnings = await this.prisma.creatorEarning.findMany({ where: { creatorId } });
    let available = new Prisma.Decimal(0);
    let pending = new Prisma.Decimal(0);
    for (const e of earnings) {
      const amount = new Prisma.Decimal((e as { creatorAmount: Prisma.Decimal.Value }).creatorAmount);
      if ((e as { releasedAt?: Date | null }).releasedAt) {
        available = available.plus(amount);
      } else {
        pending = pending.plus(amount);
      }
    }
    const currency = earnings[0]?.currency ?? 'IDR';
    return { available: available.toNumber(), pending: pending.toNumber(), currency };
  }

  listByUser(creatorId: string) {
    return this.prisma.creatorEarning.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}