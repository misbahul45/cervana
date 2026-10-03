import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async listPending() {
    const articles = await this.prisma.article.findMany({
      where: { status: 'PENDING_REVIEW' as any },
      include: { author: { select: { id: true, email: true } } },
    });
    const classes = await this.prisma.classProduct.findMany({
      where: { status: 'PENDING_REVIEW' as any },
      include: { instructor: { select: { id: true, email: true } } },
    });
    return { articles, classes };
  }

  async approve(kind: 'article' | 'class', id: string, reviewerId: string) {
    if (kind === 'article') {
      return this.prisma.article.update({
        where: { id },
        data: { status: 'PUBLISHED' as any, publishedAt: new Date(), reviewedById: reviewerId } as any,
      });
    }
    return this.prisma.classProduct.update({
      where: { id },
      data: { status: 'PUBLISHED' as any, publishedAt: new Date(), reviewedById: reviewerId } as any,
    });
  }

  async reject(kind: 'article' | 'class', id: string, reviewerId: string, feedback: string) {
    if (!feedback) throw new BadRequestException('feedback_required');
    if (kind === 'article') {
      return this.prisma.article.update({
        where: { id },
        data: { status: 'REJECTED' as any, reviewedById: reviewerId, reviewNote: feedback } as any,
      });
    }
    return this.prisma.classProduct.update({
      where: { id },
      data: { status: 'REJECTED' as any, reviewedById: reviewerId, reviewNote: feedback } as any,
    });
  }
}