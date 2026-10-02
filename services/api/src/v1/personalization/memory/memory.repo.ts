import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class MemoryRepo {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    userId: string;
    eventType: string;
    content: string;
    source?: string;
    lessonId?: string | null;
    topicId?: string | null;
    expiresAt?: Date | null;
    importance?: number;
  }) {
    return this.prisma.episodicMemory.create({
      data: {
        userId: input.userId,
        eventType: input.eventType,
        content: input.content,
        source: input.source ?? 'api',
        lessonId: input.lessonId ?? null,
        topicId: input.topicId ?? null,
        expiresAt: input.expiresAt ?? null,
        importance: input.importance ?? 0.5,
      },
    });
  }

  async listByLesson(userId: string, lessonId: string) {
    return this.prisma.episodicMemory.findMany({
      where: {
        userId,
        lessonId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async listAllByUser(userId: string, kind?: string) {
    return this.prisma.episodicMemory.findMany({
      where: {
        userId,
        ...(kind ? { eventType: kind } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async trimForLesson(userId: string, lessonId: string, keep: number) {
    const items = await this.prisma.episodicMemory.findMany({
      where: { userId, lessonId },
      orderBy: { createdAt: 'desc' },
      skip: keep,
    });
    if (items.length === 0) return 0;
    await this.prisma.episodicMemory.deleteMany({
      where: { id: { in: items.map((i) => i.id) } },
    });
    return items.length;
  }
}