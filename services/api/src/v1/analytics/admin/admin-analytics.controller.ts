import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Controller('v1/analytics/admin')
@UseGuards(JwtAuthGuard)
export class AdminAnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  @Roles(Role.ADMIN, Role.REVIEWER)
  async overview() {
    const [users, teachers, articleCount, classCount, decisions, recent] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.teacherApplication.count({ where: { status: 'APPROVED' as any } }),
      this.prisma.article.count(),
      this.prisma.classProduct.count(),
      this.prisma.decisionTrace.count(),
      this.prisma.engagementMetric.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);
    return {
      totalUsers: users,
      totalCreators: teachers,
      totalContent: articleCount + classCount,
      totalAgentDecisions: decisions,
      recentEngagement: recent,
    };
  }

  @Get('top-topics')
  @Roles(Role.ADMIN, Role.REVIEWER)
  async topTopics() {
    const mastery = await this.prisma.topicMasteryRecord.groupBy({
      by: ['topicId'],
      _count: { _all: true },
      _avg: { score: true },
      orderBy: { _count: { topicId: 'desc' } },
      take: 10,
    });
    return mastery.map((m) => ({
      topicId: m.topicId,
      learners: m._count._all,
      avgScore: Number(m._avg.score ?? 0),
    }));
  }
}