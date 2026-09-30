import { Controller, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from '@/common/authz/audit.service';
import { TraceId } from '@/common/authz/trace-id.decorator';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { GetUser, Roles } from '../auth/auth.decorator';
import { TopicEntitlementBackfillService } from './topic-entitlement-backfill.service';

@Controller('admin/entitlements')
export class AdminEntitlementsController {
  constructor(
    private readonly backfill: TopicEntitlementBackfillService,
    private readonly audit: AuditService,
  ) {}

  @Roles(Role.ADMIN)
  @Post('backfill/topic')
  async backfillTopic(@GetUser() user: AuthUser, @TraceId() traceId: string) {
    const result = await this.backfill.run();
    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'TOPIC_ENTITLEMENT_BACKFILL',
      entityType: 'Entitlement',
      entityId: 'topic-backfill',
      after: result as unknown as Record<string, number>,
      traceId,
    });
    return { message: 'Topic entitlement backfill completed', data: result };
  }
}
