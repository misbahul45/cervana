import { BadRequestException, HttpException, HttpStatus, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

export interface RateLimitOptions {
  scope: string;
  limitPerMinute: number;
}

@Injectable()
export class RateLimitService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly opts: { limitPerMinute?: number } = {},
  ) {}

  async consume(input: { userId: string; scope: string; limitPerMinute?: number }): Promise<{ allowed: boolean; remaining: number }> {
    const limit = input.limitPerMinute ?? this.opts.limitPerMinute ?? 60;
    const now = new Date();
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes()));

    const existing = await this.prisma.rateLimit.findUnique({
      where: {
        userId_scope_windowStart: { userId: input.userId, scope: input.scope, windowStart },
      },
    });

    if (!existing) {
      await this.prisma.rateLimit.create({
        data: {
          userId: input.userId,
          scope: input.scope,
          windowStart,
          count: 1,
        },
      });
      return { allowed: true, remaining: limit - 1 };
    }

    if (existing.count >= limit) {
      throw new HttpException(
        { message: 'rate_limit_exceeded', scope: input.scope, limit },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.rateLimit.update({
      where: { id: existing.id },
      data: { count: existing.count + 1 },
    });
    return { allowed: true, remaining: limit - existing.count - 1 };
  }
}