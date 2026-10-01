import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { createHash } from 'crypto';

export const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface IdempotencyRecord {
  key: string;
  userId: string;
  path: string;
  method: string;
  requestHash: string;
  responseJson: string;
  statusCode: number;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(
    ctx: ExecutionContext,
    work: () => Promise<{ statusCode: number; body: T }>,
  ): Promise<{ statusCode: number; body: T; replayed: boolean }> {
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['idempotency-key'] as string | undefined;
    const userId = req.user?.id;

    if (!key) {
      const r = await work();
      return { ...r, replayed: false };
    }

    if (!userId) {
      throw new BadRequestException('Idempotency key requires authenticated user');
    }

    const requestHash = this.hashRequest(req.body, req.params);

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key_userId: { key, userId } },
    });

    if (existing) {
      if (existing.expiresAt < new Date()) {
        await this.prisma.idempotencyKey.delete({
          where: { key_userId: { key, userId } },
        });
      } else if (existing.requestHash !== requestHash) {
        throw new BadRequestException(
          'Idempotency-Key reused with different request body',
        );
      } else {
        return {
          statusCode: existing.statusCode,
          body: JSON.parse(existing.responseJson) as T,
          replayed: true,
        };
      }
    }

    const result = await work();

    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          userId,
          path: req.route?.path ?? req.url,
          method: req.method,
          requestHash,
          responseJson: JSON.stringify(result.body),
          statusCode: result.statusCode,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_WINDOW_MS),
        },
      });
    } catch (e) {
      throw new InternalServerErrorException(
        'Failed to record idempotency key',
      );
    }

    return { ...result, replayed: false };
  }

  private hashRequest(body: unknown, params: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify({ body: body ?? null, params: params ?? null }))
      .digest('hex');
  }
}