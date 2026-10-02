import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class AdaptivePolicyRepo {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: {
    userId: string;
    topicId: string;
    nextActivityId?: string | null;
    rationale: unknown;
  }) {
    const rationaleString = JSON.stringify(input.rationale);
    const existing = await this.prisma.adaptivePolicy.findFirst({
      where: { userId: input.userId, topicId: input.topicId },
    });
    if (existing) {
      return this.prisma.adaptivePolicy.update({
        where: { id: existing.id },
        data: {
          nextActivityId: input.nextActivityId ?? null,
          rationale: rationaleString as any,
          appliedAt: new Date(),
        },
      });
    }
    return this.prisma.adaptivePolicy.create({
      data: {
        userId: input.userId,
        topicId: input.topicId,
        nextActivityId: input.nextActivityId ?? null,
        rationale: rationaleString as any,
      },
    });
  }

  async listByUser(userId: string) {
    return this.prisma.adaptivePolicy.findMany({
      where: { userId },
      orderBy: { appliedAt: 'desc' },
      take: 50,
    });
  }
}