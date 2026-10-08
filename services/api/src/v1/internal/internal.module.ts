import { Module } from '@nestjs/common';
import { ResourcesModule } from '../material/resources/resources.module';
import { InternalResourcesController } from './internal-resources.controller';
import { InternalEpisodesController } from './internal-episodes.controller';
import { InternalDecisionTracesController } from './internal-decision-traces.controller';
import { InternalAgentSessionsController } from './internal-agent-sessions.controller';
import { InternalServiceGuard } from '@/common/authz/internal-service.guard';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { IdempotencyModule } from '@/common/idempotency/idempotency.module';
import { AuthzModule } from '@/common/authz/authz.module';

@Module({
  imports: [ResourcesModule, PrismaModule, IdempotencyModule, AuthzModule],
  controllers: [
    InternalResourcesController,
    InternalEpisodesController,
    InternalDecisionTracesController,
    InternalAgentSessionsController,
  ],
  providers: [InternalServiceGuard],
})
export class InternalModule {}
