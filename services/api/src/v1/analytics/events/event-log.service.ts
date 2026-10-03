import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

const PII_KEYS = new Set([
  'email',
  'name',
  'phone',
  'address',
  'ip',
  'userAgent',
  'password',
  'token',
  'authorization',
  'cookie',
]);

@Injectable()
export class EventLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    userId: string;
    action:
      | 'LESSON_COMPLETED'
      | 'QUIZ_SUBMITTED'
      | 'PURCHASE_COMPLETED'
      | 'PAYOUT_RELEASED'
      | 'BADGE_ISSUED';
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const sanitized = this.stripPii(input.metadata ?? {});
    return this.prisma.eventLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityId: input.entityId,
        metadata: sanitized as any,
        piiRedacted: true,
      },
    });
  }

  async listByAction(action: string, limit = 100) {
    return this.prisma.eventLog.findMany({
      where: { action: action as any },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listByUser(userId: string, limit = 100) {
    return this.prisma.eventLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private stripPii(input: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (PII_KEYS.has(k)) continue;
      out[k] = v;
    }
    return out;
  }
}