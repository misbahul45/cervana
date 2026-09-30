import { Injectable } from '@nestjs/common';
import { ContentStatus, EnrollmentStatus, Prisma, ProductAccessType, TenantStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor } from '@/common/authz/policy.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { READABLE_BY_BUYERS } from '../marketplace/content-state';
import { MarketplaceClassQueryDtoType } from './classes.dto';

const HOLDING: EnrollmentStatus[] = [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED];

const publicSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  coverImage: true,
  accessType: true,
  price: true,
  currency: true,
  format: true,
  difficulty: true,
  durationMinutes: true,
  capacity: true,
  publishedAt: true,
  instructor: { select: { id: true, name: true, image: true } },
  tenant: { select: { id: true, name: true, slug: true, logo: true } },
} satisfies Prisma.ClassProductSelect;

const orderings: Record<MarketplaceClassQueryDtoType['sort'], Prisma.ClassProductOrderByWithRelationInput> = {
  newest: { publishedAt: 'desc' },
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
  title: { title: 'asc' },
};

@Injectable()
export class MarketplaceClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(query: MarketplaceClassQueryDtoType) {
    const where: Prisma.ClassProductWhereInput = {
      status: ContentStatus.PUBLISHED,
      tenant: { status: TenantStatus.ACTIVE },
      ...(query.tenantId && { tenantId: query.tenantId }),
      ...(query.accessType && { accessType: query.accessType }),
      ...(query.format && { format: query.format }),
      ...(query.difficulty && { difficulty: query.difficulty }),
      ...(query.q && {
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.classProduct.findMany({
        where,
        select: publicSelect,
        orderBy: orderings[query.sort],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.classProduct.count({ where }),
    ]);
    const seats = await this.seatsLeft(rows.map((row) => ({ id: row.id, capacity: row.capacity })));
    const data = rows.map(({ capacity, ...rest }) => ({ ...rest, capacity, seatsLeft: seats.get(rest.id) ?? null }));
    return {
      message: 'Successfully retrieved marketplace classes',
      data: { data, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } },
    };
  }

  async findOne(id: string) {
    const cls = await this.prisma.classProduct.findFirst({
      where: { id, status: ContentStatus.PUBLISHED, tenant: { status: TenantStatus.ACTIVE } },
      select: {
        ...publicSelect,
        sessions: {
          orderBy: { startsAt: 'asc' },
          select: { id: true, startsAt: true, endsAt: true, status: true },
        },
      },
    });
    if (!cls) {
      throw new AppError('Class not found', 404, AppErrorCode.CONTENT_NOT_PUBLISHED);
    }
    const seats = await this.seatsLeft([{ id: cls.id, capacity: cls.capacity }]);
    return { message: 'Successfully retrieved class', data: { ...cls, seatsLeft: seats.get(cls.id) ?? null } };
  }

  async access(actor: Actor, id: string) {
    const cls = await this.readable(id);
    const decision = await this.decide(actor.id, cls.id, cls.accessType);
    return { message: 'Successfully checked access', data: { classId: id, accessType: cls.accessType, ...decision } };
  }

  async materials(actor: Actor, id: string) {
    const cls = await this.readable(id);
    const decision = await this.decide(actor.id, cls.id, cls.accessType);
    if (!decision.accessible) {
      throw new AppError('Join or purchase this class to see its materials', 403, AppErrorCode.ENTITLEMENT_REQUIRED);
    }
    const sessions = await this.prisma.classSession.findMany({
      where: { classProductId: id },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, endsAt: true, status: true, meetingUrl: true, recordingUrl: true },
    });
    return {
      message: 'Successfully retrieved class materials',
      data: { classId: id, title: cls.title, description: cls.description, sessions },
    };
  }

  private async readable(id: string) {
    const cls = await this.prisma.classProduct.findFirst({
      where: { id, status: { in: [...READABLE_BY_BUYERS] }, tenant: { status: TenantStatus.ACTIVE } },
      select: { id: true, title: true, description: true, accessType: true },
    });
    if (!cls) {
      throw new AppError('Class not found', 404, AppErrorCode.CONTENT_NOT_PUBLISHED);
    }
    return cls;
  }

  private async decide(userId: string, classId: string, accessType: ProductAccessType) {
    const [enrollment, entitled] = await Promise.all([
      this.prisma.classEnrollment.findUnique({
        where: { classProductId_userId: { classProductId: classId, userId } },
        select: { status: true },
      }),
      this.entitlements.hasActiveAccess(this.prisma, userId, { classId }),
    ]);
    const enrolled = !!enrollment && HOLDING.includes(enrollment.status);
    const accessible = enrolled && entitled;
    return {
      accessible,
      enrolled,
      entitled,
      reason: accessible ? (accessType === ProductAccessType.FREE ? 'ENROLLED' : 'PURCHASED') : 'ENTITLEMENT_REQUIRED',
    } as const;
  }

  private async seatsLeft(classes: Array<{ id: string; capacity: number | null }>): Promise<Map<string, number>> {
    const limited = classes.filter((cls) => cls.capacity !== null);
    if (limited.length === 0) return new Map();
    const counts = await this.prisma.classEnrollment.groupBy({
      by: ['classProductId'],
      where: { classProductId: { in: limited.map((cls) => cls.id) }, status: { in: HOLDING } },
      _count: { _all: true },
    });
    const taken = new Map(counts.map((row) => [row.classProductId, row._count._all] as [string, number]));
    return new Map(limited.map((cls) => [cls.id, Math.max(0, (cls.capacity as number) - (taken.get(cls.id) ?? 0))] as [string, number]));
  }
}
