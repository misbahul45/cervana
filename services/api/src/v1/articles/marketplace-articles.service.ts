import { Injectable } from '@nestjs/common';
import { ContentStatus, Prisma, ProductAccessType, TenantStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor } from '@/common/authz/policy.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { READABLE_BY_BUYERS } from '../marketplace/content-state';
import { MarketplaceArticleQueryDtoType } from './articles.dto';

const publicSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  accessType: true,
  price: true,
  currency: true,
  publishedAt: true,
  category: { select: { id: true, name: true } },
  author: { select: { id: true, name: true, image: true } },
  tenant: { select: { id: true, name: true, slug: true, logo: true } },
} satisfies Prisma.ArticleSelect;

const orderings: Record<MarketplaceArticleQueryDtoType['sort'], Prisma.ArticleOrderByWithRelationInput> = {
  newest: { publishedAt: 'desc' },
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
  title: { title: 'asc' },
};

@Injectable()
export class MarketplaceArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(query: MarketplaceArticleQueryDtoType) {
    const where: Prisma.ArticleWhereInput = {
      status: ContentStatus.PUBLISHED,
      tenant: { status: TenantStatus.ACTIVE },
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.tenantId && { tenantId: query.tenantId }),
      ...(query.accessType && { accessType: query.accessType }),
      ...(query.q && {
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { excerpt: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        select: publicSelect,
        orderBy: orderings[query.sort],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.article.count({ where }),
    ]);
    return {
      message: 'Successfully retrieved marketplace articles',
      data: { data, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } },
    };
  }

  async findOne(id: string) {
    const article = await this.prisma.article.findFirst({
      where: { id, status: ContentStatus.PUBLISHED, tenant: { status: TenantStatus.ACTIVE } },
      select: publicSelect,
    });
    if (!article) {
      throw new AppError('Article not found', 404, AppErrorCode.CONTENT_NOT_PUBLISHED);
    }
    return { message: 'Successfully retrieved article', data: article };
  }

  async access(actor: Actor, id: string) {
    const article = await this.readable(id);
    const decision = await this.decide(actor.id, article);
    return { message: 'Successfully checked access', data: { articleId: id, accessType: article.accessType, ...decision } };
  }

  async content(actor: Actor, id: string) {
    const article = await this.readable(id);
    const decision = await this.decide(actor.id, article);
    if (!decision.accessible) {
      throw new AppError('Purchase this article to read it', 403, AppErrorCode.ENTITLEMENT_REQUIRED);
    }
    const version = article.publishedVersion!;
    return {
      message: 'Successfully retrieved article content',
      data: {
        id: article.id,
        title: version.title,
        content: version.content,
        versionNumber: version.versionNumber,
        publishedAt: version.publishedAt,
        accessType: article.accessType,
      },
    };
  }

  private async readable(id: string) {
    const article = await this.prisma.article.findFirst({
      where: { id, tenant: { status: TenantStatus.ACTIVE }, status: { in: [...READABLE_BY_BUYERS] } },
      select: {
        id: true,
        status: true,
        accessType: true,
        publishedVersionId: true,
        publishedVersion: { select: { title: true, content: true, versionNumber: true, publishedAt: true } },
      },
    });
    if (!article || !article.publishedVersion) {
      throw new AppError('Article not found', 404, AppErrorCode.CONTENT_NOT_PUBLISHED);
    }
    return article;
  }

  private async decide(
    userId: string,
    article: { id: string; status: ContentStatus; accessType: ProductAccessType },
  ): Promise<{ accessible: boolean; reason: 'FREE' | 'ENTITLED' | 'ENTITLEMENT_REQUIRED' }> {
    if (article.accessType === ProductAccessType.FREE) {
      return article.status === ContentStatus.PUBLISHED
        ? { accessible: true, reason: 'FREE' }
        : { accessible: false, reason: 'ENTITLEMENT_REQUIRED' };
    }
    const entitled = await this.entitlements.hasActiveAccess(this.prisma, userId, { articleId: article.id });
    return entitled ? { accessible: true, reason: 'ENTITLED' } : { accessible: false, reason: 'ENTITLEMENT_REQUIRED' };
  }
}
