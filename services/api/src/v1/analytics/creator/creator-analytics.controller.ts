import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { SnapshotService } from '../snapshots/snapshot.service';

@Controller('analytics/creator')
@UseGuards(JwtAuthGuard)
export class CreatorAnalyticsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: SnapshotService,
  ) {}

  @Get('me')
  @Roles(Role.TEACHER, Role.ADMIN, Role.REVIEWER)
  async me(@GetUser('id') userId: string) {
    const metrics = await this.prisma.creatorOutcomeMetric.findMany({
      where: { creatorId: userId },
      orderBy: { windowStart: 'desc' },
      take: 12,
    });
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const refundCount = await this.prisma.refund.count({ where: { requestedById: userId } });
    return {
      metrics,
      recentOrders: orders,
      refundCount,
    };
  }
}