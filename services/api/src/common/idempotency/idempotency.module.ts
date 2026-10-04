import { Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyKeyGuard } from './idempotency-key.guard';

@Module({
  providers: [IdempotencyService, IdempotencyKeyGuard],
  exports: [IdempotencyService, IdempotencyKeyGuard],
})
export class IdempotencyModule {}