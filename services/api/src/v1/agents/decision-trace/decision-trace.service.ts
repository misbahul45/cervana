import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

const TRACE_TTL_DAYS = 90;

@Injectable()
export class DecisionTraceService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    agentName: string;
    agentScope: 'TUTOR' | 'CURRICULUM' | 'ASSESSMENT' | 'CREATOR_ASSISTANT' | 'CAREER';
    userId: string;
    promptHash: string;
    responseHash: string;
    toolCalls: Array<{ name: string; endpoint: string; result: unknown }>;
    deterministicOutputs: Record<string, unknown>;
    ownershipCheckouts?: Array<{ endpoint: string; result: 'allow' | 'deny' }>;
  }) {
    const ttlAt = new Date(Date.now() + TRACE_TTL_DAYS * 86_400_000);
    return this.prisma.decisionTrace.create({
      data: { ...input, ttlAt } as any,
    });
  }

  async listByUser(userId: string, limit = 50) {
    return this.prisma.decisionTrace.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}