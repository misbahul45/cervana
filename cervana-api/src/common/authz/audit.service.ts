import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  actorRole?: Role | null;
  tenantId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  reason?: string | null;
  traceId?: string | null;
}

type AuditClient = Pick<PrismaService, 'auditLog'>;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry, client: AuditClient = this.prisma) {
    return client.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        actorRole: entry.actorRole ?? null,
        tenantId: entry.tenantId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: entry.before ?? Prisma.JsonNull,
        after: entry.after ?? Prisma.JsonNull,
        reason: entry.reason ?? null,
        traceId: entry.traceId ?? null,
      },
    });
  }
}
