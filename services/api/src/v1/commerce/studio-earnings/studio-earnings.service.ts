import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class StudioEarningsService {
  constructor(private readonly prisma: PrismaService) {}

  async summarize(creatorId: string) {
    const earnings = await this.prisma.creatorEarning.findMany({ where: { creatorId } });
    let available = 0;
    let pending = 0;
    for (const e of earnings) {
      const amount = Number((e as { creatorAmount: unknown }).creatorAmount);
      if ((e as { releasedAt?: Date | null }).releasedAt) {
        available += amount;
      } else {
        pending += amount;
      }
    }
    const currency = earnings[0]?.currency ?? 'IDR';
    return { available, pending, currency };
  }

  listByUser(creatorId: string) {
    return this.prisma.creatorEarning.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}