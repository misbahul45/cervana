import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class CreatorProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string) {
    const ta = await this.prisma.teacherApplication.findFirst({
      where: { userId, status: 'APPROVED' as any },
      orderBy: { reviewedAt: 'desc' },
    });
    if (!ta) return null;

    const articles = await this.prisma.article.findMany({
      where: { authorId: userId, status: 'PUBLISHED' as any },
      orderBy: { publishedAt: 'desc' },
    });
    const classes = await this.prisma.classProduct.findMany({
      where: { instructorId: userId, status: 'PUBLISHED' as any },
      orderBy: { publishedAt: 'desc' },
    });
    const badges = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    });

    return {
      id: userId,
      fullName: ta.fullName,
      bio: ta.bio,
      portfolioUrl: ta.portfolioUrl,
      articles,
      classes,
      badges,
    };
  }
}