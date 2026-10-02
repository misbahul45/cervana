import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class MasteryRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserAndTopic(userId: string, topicId: string) {
    return this.prisma.topicMasteryRecord.findUnique({
      where: { userId_topicId: { userId, topicId } },
    });
  }

  async upsert(input: {
    userId: string;
    topicId: string;
    score: number;
    evidenceCount?: number;
    lastObservedAt?: Date;
  }) {
    const now = input.lastObservedAt ?? new Date();
    return this.prisma.topicMasteryRecord.upsert({
      where: { userId_topicId: { userId: input.userId, topicId: input.topicId } },
      update: {
        score: input.score,
        lastObservedAt: now,
        evidenceCount: { increment: 1 },
      },
      create: {
        userId: input.userId,
        topicId: input.topicId,
        score: input.score,
        confidence: 0,
        evidenceCount: 1,
        lastObservedAt: now,
      },
    });
  }

  async listByUser(userId: string) {
    return this.prisma.topicMasteryRecord.findMany({
      where: { userId },
      orderBy: { score: 'desc' },
    });
  }
}