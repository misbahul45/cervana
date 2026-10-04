import { Body, Controller, Param, Post, HttpCode } from '@nestjs/common';
import { InternalOnly } from '@/common/authz/internal-service.guard';
import { RequireIdempotencyKey } from '@/common/idempotency/require-idempotency-key.decorator';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AiCreditsService, ReserveResult, RejectResult } from './ai-credits.service';
import { z } from 'zod';

const InternalBodySchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().positive(),
  sourceType: z.string().min(1),
  sourceId: z.string().optional(),
  operationId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const TopUpBodySchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().positive(),
  sourceType: z.enum(['PURCHASE', 'BONUS', 'REFUND', 'EARN', 'EXPIRE']),
  sourceId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

@Controller('internal/credits')
@InternalOnly()
export class AiCreditsInternalController {
  constructor(private readonly credits: AiCreditsService) {}

  @Post('reservations')
  @HttpCode(201)
  @RequireIdempotencyKey()
  async reserve(@Body(new ZodPipe(InternalBodySchema)) body: any): Promise<ReserveResult | RejectResult> {
    return this.credits.reserve(body);
  }

  @Post('reservations/:id/settle')
  @HttpCode(200)
  @RequireIdempotencyKey()
  async settle(
    @Param('id') id: string,
    @Body() body: { actualAmount: number; metadata?: Record<string, unknown> },
  ) {
    return this.credits.settle({
      userId: (body.metadata?.userId as string) ?? '',
      reservationId: id,
      actualAmount: body.actualAmount,
      metadata: body.metadata,
    });
  }

  @Post('reservations/:id/release')
  @HttpCode(200)
  @RequireIdempotencyKey()
  async release(@Param('id') id: string, @Body() body: { reason: string }) {
    await this.credits.release(id, body.reason);
    return { released: true };
  }

  @Post('top-up')
  @HttpCode(200)
  @RequireIdempotencyKey()
  async topUp(@Body(new ZodPipe(TopUpBodySchema)) body: any) {
    return this.credits.topUp({
      userId: body.userId,
      amount: body.amount,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      idempotencyKey: `topup:${body.userId}:${body.sourceType}:${body.amount}:${body.sourceId ?? ''}`,
      metadata: body.metadata,
    });
  }
}