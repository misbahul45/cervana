import { Module } from '@nestjs/common';
import { AiCreditsService } from './ai-credits.service';
import { AiCreditsInternalController } from './ai-credits-internal.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { AuthzModule } from '@/common/authz/authz.module';
import { IdempotencyModule } from '@/common/idempotency/idempotency.module';

@Module({
  controllers: [AiCreditsInternalController],
  providers: [AiCreditsService],
  imports: [PrismaModule, AuthzModule, IdempotencyModule],
  exports: [AiCreditsService],
})
export class AiCreditsModule {}