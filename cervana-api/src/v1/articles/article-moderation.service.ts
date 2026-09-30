import { Injectable } from '@nestjs/common';
import { Article, ContentStatus, Prisma, TenantStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor, PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { DomainEventBus } from '@/common/events/domain-event-bus';
import { assertContentTransition } from '../marketplace/content-state';
import { ARTICLE_AGGREGATE, ArticlePublishedPayload, ContentEvents } from '../marketplace/content-events';
import { AdminArticleQueryDtoType } from './articles.dto';

const reviewSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  accessType: true,
  price: true,
  currency: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  reviewNote: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  tenant: { select: { id: true, name: true, slug: true, status: true } },
  author: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ArticleSelect;

@Injectable()
export class ArticleModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly bus: DomainEventBus,
  ) {}

  async queue(actor: Actor, query: AdminArticleQueryDtoType) {
    this.policy.assertAdmin(actor);
    const where: Prisma.ArticleWhereInput = {
      status: query.status,
      ...(query.tenantId && { tenantId: query.tenantId }),
    };
    const [data, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        select: reviewSelect,
        orderBy: query.status === ContentStatus.PENDING_REVIEW ? { submittedAt: 'asc' } : { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.article.count({ where }),
    ]);
    return {
      message: 'Successfully retrieved the article queue',
      data: { data, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } },
    };
  }

  async findOne(actor: Actor, id: string) {
    this.policy.assertAdmin(actor);
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: {
        ...reviewSelect,
        publishedVersionId: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: { id: true, versionNumber: true, title: true, content: true, publishedAt: true, createdAt: true },
        },
      },
    });
    if (!article) {
      throw new AppError('Article not found', 404, AppErrorCode.NOT_FOUND);
    }
    return { message: 'Successfully retrieved article', data: article };
  }

  approve(actor: Actor, id: string, note: string | undefined, traceId?: string) {
    return this.review(actor, id, ContentStatus.PUBLISHED, 'ARTICLE_APPROVED', note, traceId, async (tx, article, now) => {
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: article.tenantId }, select: { status: true } });
      if (tenant.status !== TenantStatus.ACTIVE) {
        throw new AppError('The tenant is not active', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      const version = await tx.articleVersion.findFirst({
        where: { articleId: article.id, publishedAt: null },
        orderBy: { versionNumber: 'desc' },
      });
      if (!version) {
        throw new AppError('There is no version to publish', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      await tx.articleVersion.update({ where: { id: version.id }, data: { publishedAt: now } });
      return {
        data: { publishedVersionId: version.id, publishedAt: article.publishedAt ?? now },
        after: async () => {
          const payload: ArticlePublishedPayload = {
            articleId: article.id,
            versionId: version.id,
            tenantId: article.tenantId,
            authorId: article.authorId,
            accessType: article.accessType,
            price: article.price?.toString() ?? null,
            currency: article.currency,
          };
          await this.bus.publish(
            {
              type: ContentEvents.ArticlePublished,
              aggregateType: ARTICLE_AGGREGATE,
              aggregateId: article.id,
              dedupeKey: `${ContentEvents.ArticlePublished}:${article.id}:${version.id}`,
              payload,
              tenantId: article.tenantId,
              actorId: actor.id,
              traceId: traceId ?? null,
            },
            tx,
          );
        },
      };
    });
  }

  reject(actor: Actor, id: string, reason: string, traceId?: string) {
    return this.review(actor, id, ContentStatus.REJECTED, 'ARTICLE_REJECTED', reason, traceId);
  }

  suspend(actor: Actor, id: string, reason: string, traceId?: string) {
    return this.review(actor, id, ContentStatus.SUSPENDED, 'ARTICLE_SUSPENDED', reason, traceId);
  }

  reinstate(actor: Actor, id: string, note: string | undefined, traceId?: string) {
    return this.review(actor, id, ContentStatus.PUBLISHED, 'ARTICLE_REINSTATED', note, traceId, async (tx, article) => {
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: article.tenantId }, select: { status: true } });
      if (tenant.status !== TenantStatus.ACTIVE || !article.publishedVersionId) {
        throw new AppError('The article cannot be reinstated', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      return { data: {} };
    });
  }

  archive(actor: Actor, id: string, reason: string | undefined, traceId?: string) {
    return this.review(actor, id, ContentStatus.ARCHIVED, 'ARTICLE_ARCHIVED', reason, traceId);
  }

  private async review(
    actor: Actor,
    id: string,
    target: ContentStatus,
    action: string,
    note: string | undefined,
    traceId: string | undefined,
    prepare?: (
      tx: Prisma.TransactionClient,
      article: Article,
      now: Date,
    ) => Promise<{ data: Prisma.ArticleUncheckedUpdateInput; after?: () => Promise<void> }>,
  ) {
    this.policy.assertAdmin(actor);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Article" WHERE id = ${id} FOR UPDATE`;
      const article = await tx.article.findUnique({ where: { id } });
      if (!article) {
        throw new AppError('Article not found', 404, AppErrorCode.NOT_FOUND);
      }
      if (article.status === target) {
        return { changed: false, status: article.status };
      }
      assertContentTransition(article.status, target);

      const now = new Date();
      const prepared = prepare ? await prepare(tx, article, now) : { data: {} };
      const updated = await tx.article.update({
        where: { id },
        data: {
          status: target,
          reviewedById: actor.id,
          reviewedAt: now,
          reviewNote: note ?? null,
          ...prepared.data,
        },
        select: { status: true },
      });
      if (prepared.after) await prepared.after();

      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          tenantId: article.tenantId,
          action,
          entityType: 'Article',
          entityId: id,
          before: { status: article.status },
          after: { status: updated.status },
          reason: note ?? null,
          traceId,
        },
        tx,
      );
      return { changed: true, status: updated.status };
    });
    return {
      message: result.changed ? 'Article updated' : 'Article already in the requested state',
      data: { id, status: result.status, changed: result.changed },
    };
  }
}
