import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AuditLogQueryType } from './audit-logs.dto';

const summarySelect = {
  id: true,
  actorId: true,
  actorRole: true,
  tenantId: true,
  action: true,
  entityType: true,
  entityId: true,
  reason: true,
  traceId: true,
  createdAt: true,
} satisfies Prisma.AuditLogSelect;

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditLogQueryType) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action && { action: query.action }),
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.entityId && { entityId: query.entityId }),
      ...(query.actorId && { actorId: query.actorId }),
      ...((query.from || query.to) && {
        createdAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) },
      }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: summarySelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const actors = await this.actorsById(rows.map((row) => row.actorId));
    return {
      message: 'Successfully retrieved audit logs',
      data: {
        data: rows.map((row) => ({ ...row, actor: row.actorId ? (actors.get(row.actorId) ?? null) : null })),
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      },
    };
  }

  async findOne(id: string) {
    const row = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!row) {
      throw new AppError('Audit log not found', 404, AppErrorCode.NOT_FOUND);
    }
    const actors = await this.actorsById([row.actorId]);
    return { message: 'Successfully retrieved audit log', data: { ...row, actor: row.actorId ? (actors.get(row.actorId) ?? null) : null } };
  }

  async actions() {
    const rows = await this.prisma.auditLog.groupBy({ by: ['action'], orderBy: { action: 'asc' } });
    return { message: 'Successfully retrieved audit actions', data: rows.map((row) => row.action) };
  }

  private async actorsById(ids: Array<string | null>) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map<string, { id: string; name: string; email: string; role: string }>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, email: true, role: true },
    });
    return new Map(users.map((user) => [user.id, user]));
  }
}
