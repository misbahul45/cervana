import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class BadgeIssuanceRepo {
  constructor(private readonly prisma: PrismaService) {}

  async awardIfMissing(userId: string, achievementId: string): Promise<boolean> {
    try {
      await this.prisma.userAchievement.create({
        data: {
          userId,
          achievementId,
        },
      });
      return true;
    } catch (e: any) {
      if (e?.code === 'P2002') return false;
      throw e;
    }
  }

  async listMasters(userId: string) {
    return this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    });
  }
}