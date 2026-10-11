import { Injectable } from '@nestjs/common';
import { ContentStatus, Prisma, TenantStatus } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';

const articleCard = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  accessType: true,
  price: true,
  currency: true,
  publishedAt: true,
} satisfies Prisma.ArticleSelect;

const classCard = {
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
  publishedAt: true,
} satisfies Prisma.ClassProductSelect;

@Injectable()
export class CreatorProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string) {
    const ta = await this.prisma.teacherApplication.findFirst({
      where: { userId, status: 'APPROVED' as any },
      orderBy: { reviewedAt: 'desc' },
    });
    if (!ta) return null;

    const visible = { status: ContentStatus.PUBLISHED, tenant: { status: TenantStatus.ACTIVE } };
    const articles = await this.prisma.article.findMany({
      where: { authorId: userId, ...visible },
      select: articleCard,
      orderBy: { publishedAt: 'desc' },
    });
    const classes = await this.prisma.classProduct.findMany({
      where: { instructorId: userId, ...visible },
      select: classCard,
      orderBy: { publishedAt: 'desc' },
    });
    const earned = await this.prisma.userAchievement.findMany({
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
      badges: earned.map(({ achievement, awardedAt }) => ({
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        iconName: achievement.iconName,
        awardedAt,
      })),
    };
  }
}
