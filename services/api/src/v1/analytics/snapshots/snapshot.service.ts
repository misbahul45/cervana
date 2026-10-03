import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class SnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshotMastery(): Promise<number> {
    const mastery = await this.prisma.topicMasteryRecord.findMany();
    let count = 0;
    for (const m of mastery) {
      await this.prisma.masterySnapshot.create({
        data: {
          userId: m.userId,
          topicId: m.topicId,
          score: m.score,
          attempts: m.evidenceCount,
          snapshotAt: new Date(),
        },
      });
      count += 1;
    }
    return count;
  }

  async snapshotEngagement(): Promise<number> {
    const now = new Date();
    const since1d = new Date(now.getTime() - 86_400_000);
    const since7d = new Date(now.getTime() - 7 * 86_400_000);
    const since30d = new Date(now.getTime() - 30 * 86_400_000);

    const events1d = await this.prisma.eventLog.findMany({ where: { createdAt: { gte: since1d } } });
    const events7d = await this.prisma.eventLog.findMany({ where: { createdAt: { gte: since7d } } });
    const events30d = await this.prisma.eventLog.findMany({ where: { createdAt: { gte: since30d } } });

    const users = await this.prisma.user.findMany({ select: { id: true } });
    const totalUsers = users.length || 1;

    await this.prisma.engagementMetric.create({
      data: {
        cohortId: 'global',
        window: 'DAILY',
        uniqueUsers: new Set(events1d.map((e) => e.userId)).size,
        totalEvents: events1d.length,
      },
    });
    await this.prisma.engagementMetric.create({
      data: {
        cohortId: 'global',
        window: 'WEEKLY',
        uniqueUsers: new Set(events7d.map((e) => e.userId)).size,
        totalEvents: events7d.length,
      },
    });
    await this.prisma.engagementMetric.create({
      data: {
        cohortId: 'global',
        window: 'MONTHLY',
        uniqueUsers: new Set(events30d.map((e) => e.userId)).size,
        totalEvents: events30d.length,
        createdAt: new Date(),
      },
    });
    void totalUsers;
    return 3;
  }

  async snapshotCreatorOutcome(): Promise<number> {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const now = new Date();
    const applications = await this.prisma.teacherApplication.findMany({
      where: { status: 'APPROVED' as any },
    });
    let count = 0;
    for (const a of applications) {
      const creatorId = a.userId;
      const sales = await this.prisma.order.count({ where: { userId: creatorId } });
      await this.prisma.creatorOutcomeMetric.create({
        data: {
          creatorId,
          windowStart: since,
          windowEnd: now,
          salesCount: sales,
          completionRate: 0,
          satisfaction: 0,
          totalRevenue: 0,
        },
      });
      count += 1;
    }
    return count;
  }

  async runAll(): Promise<{ mastery: number; engagement: number; creator: number }> {
    const [mastery, engagement, creator] = await Promise.all([
      this.snapshotMastery(),
      this.snapshotEngagement(),
      this.snapshotCreatorOutcome(),
    ]);
    return { mastery, engagement, creator };
  }
}