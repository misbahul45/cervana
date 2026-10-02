import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class MisconceptionRepo {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: {
    userId: string;
    conceptKey: string;
    topicId?: string;
    evidence?: unknown;
    confidence?: number;
  }) {
    return this.prisma.misconception.upsert({
      where: { userId_conceptKey: { userId: input.userId, conceptKey: input.conceptKey } },
      update: {
        count: { increment: 1 },
        lastSeenAt: new Date(),
      },
      create: {
        userId: input.userId,
        conceptKey: input.conceptKey,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
  }

  async listActiveByUser(userId: string) {
    return this.prisma.misconception.findMany({
      where: { userId, status: 'OPEN' as any },
      orderBy: { lastSeenAt: 'desc' },
    });
  }
}