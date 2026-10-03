import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class SkillNodeRepo {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: {
    userId: string;
    topicId: string;
    state: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'MASTERED';
    progress: number;
  }) {
    return this.prisma.skillNode.upsert({
      where: { userId_topicId: { userId: input.userId, topicId: input.topicId } },
      update: { state: input.state, progress: input.progress },
      create: {
        userId: input.userId,
        topicId: input.topicId,
        state: input.state,
        progress: input.progress,
      },
    });
  }

  async listByUser(userId: string) {
    return this.prisma.skillNode.findMany({ where: { userId } });
  }
}