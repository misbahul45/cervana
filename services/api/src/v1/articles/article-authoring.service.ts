import { Injectable } from '@nestjs/common';
import { Article, ContentStatus, Prisma, ProductAccessType, TenantRole } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { slugify } from '@/common/lib/utils';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { TenantContext, tenantWhere } from '@/common/tenancy/tenant-context';
import { money } from '../commerce/money';
import { assertContentTransition, assertEditable } from '../marketplace/content-state';
import { assertOwnedUploadedFile } from '../uploads/uploaded-file';
import { UploadsService } from '../uploads/uploads.service';
import {
  CreateArticleDtoType,
  TeacherArticleQueryDtoType,
  UpdateArticleDtoType,
} from './articles.dto';

const MANAGING_ROLES: readonly TenantRole[] = [TenantRole.OWNER, TenantRole.MANAGER, TenantRole.EDITOR];

const summarySelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  accessType: true,
  price: true,
  currency: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  reviewNote: true,
  publishedAt: true,
  authorId: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ArticleSelect;

@Injectable()
export class ArticleAuthoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly uploads: UploadsService,
  ) {}

  async create(actor: Actor, ctx: TenantContext, dto: CreateArticleDtoType, traceId?: string) {
    const tenantId = this.requireMember(ctx);
    const price = this.resolvePrice(dto.accessType, dto.price);
    if (dto.coverImage) assertOwnedUploadedFile(this.uploads, actor, dto.coverImage, 'Cover image');
    if (dto.categoryId) await this.assertCategory(dto.categoryId);

    const article = await this.prisma.$transaction(async (tx) => {
      const slug = dto.slug ?? (await this.uniqueSlug(tx, tenantId, slugify(dto.title)));
      const created = await this.translateConflict(() =>
        tx.article.create({
          data: {
            tenantId,
            authorId: actor.id,
            title: dto.title,
            slug,
            excerpt: dto.excerpt ?? null,
            coverImage: dto.coverImage ?? Prisma.JsonNull,
            categoryId: dto.categoryId ?? null,
            accessType: dto.accessType,
            price,
            status: ContentStatus.DRAFT,
            versions: {
              create: { versionNumber: 1, title: dto.title, content: dto.content, createdById: actor.id },
            },
          },
          select: summarySelect,
        }),
      );
      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          tenantId,
          action: 'ARTICLE_CREATED',
          entityType: 'Article',
          entityId: created.id,
          after: { status: created.status, accessType: created.accessType },
          traceId,
        },
        tx,
      );
      return created;
    });

    return { message: 'Article draft created', data: article };
  }

  async list(actor: Actor, ctx: TenantContext, query: TeacherArticleQueryDtoType) {
    const tenantId = this.requireMember(ctx);
    const where: Prisma.ArticleWhereInput = {
      ...tenantWhere(ctx),
      ...(query.status && { status: query.status }),
      ...(this.ownOnly(ctx) && { authorId: actor.id }),
    };
    const [data, total] = await Promise.all([
      this.prisma.article.findMany({
        where: { ...where, tenantId },
        select: summarySelect,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.article.count({ where: { ...where, tenantId } }),
    ]);
    return {
      message: 'Successfully retrieved articles',
      data: { data, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } },
    };
  }

  async findOne(actor: Actor, ctx: TenantContext, id: string) {
    const tenantId = this.requireMember(ctx);
    const article = await this.prisma.article.findFirst({
      where: { id, tenantId },
      select: {
        ...summarySelect,
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: { id: true, versionNumber: true, title: true, content: true, publishedAt: true, createdAt: true },
        },
      },
    });
    if (!article || (this.ownOnly(ctx) && article.authorId !== actor.id)) {
      throw new AppError('Article not found', 404, AppErrorCode.NOT_FOUND);
    }
    return { message: 'Successfully retrieved article', data: article };
  }

  async update(actor: Actor, ctx: TenantContext, id: string, dto: UpdateArticleDtoType, traceId?: string) {
    const tenantId = this.requireMember(ctx);
    if (dto.coverImage) assertOwnedUploadedFile(this.uploads, actor, dto.coverImage, 'Cover image');
    if (dto.categoryId) await this.assertCategory(dto.categoryId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const article = await this.lockOwned(tx, ctx, actor, id, tenantId);
      assertEditable(article.status);

      const accessType = (dto.accessType ?? article.accessType) as ProductAccessType;
      const priceInput = dto.price !== undefined ? dto.price : (article.price?.toString() ?? undefined);
      const price = this.resolvePrice(accessType, accessType === ProductAccessType.FREE && dto.price === undefined ? undefined : priceInput);

      const slug = dto.slug && dto.slug !== article.slug ? dto.slug : undefined;
      const data: Prisma.ArticleUpdateInput = {
        accessType,
        price,
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.excerpt !== undefined && { excerpt: dto.excerpt }),
        ...(dto.coverImage !== undefined && { coverImage: dto.coverImage }),
        ...(dto.categoryId !== undefined && { category: { connect: { id: dto.categoryId } } }),
        ...(slug !== undefined && { slug }),
      };
      const result = await this.translateConflict(() =>
        tx.article.update({ where: { id }, data, select: summarySelect }),
      );

      if (dto.title !== undefined || dto.content !== undefined) {
        const working = await tx.articleVersion.findFirst({
          where: { articleId: id, publishedAt: null },
          orderBy: { versionNumber: 'desc' },
        });
        if (working) {
          await tx.articleVersion.update({
            where: { id: working.id },
            data: {
              ...(dto.title !== undefined && { title: dto.title }),
              ...(dto.content !== undefined && { content: dto.content }),
            },
          });
        } else {
          const latest = await tx.articleVersion.findFirst({ where: { articleId: id }, orderBy: { versionNumber: 'desc' } });
          await tx.articleVersion.create({
            data: {
              articleId: id,
              versionNumber: (latest?.versionNumber ?? 0) + 1,
              title: dto.title ?? article.title,
              content: dto.content ?? latest?.content ?? '',
              createdById: actor.id,
            },
          });
        }
      }

      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          tenantId,
          action: 'ARTICLE_UPDATED',
          entityType: 'Article',
          entityId: id,
          after: { fields: Object.keys(dto) },
          traceId,
        },
        tx,
      );
      return result;
    });

    return { message: 'Article updated', data: updated };
  }

  submitReview(actor: Actor, ctx: TenantContext, id: string, traceId?: string) {
    return this.move(actor, ctx, id, ContentStatus.PENDING_REVIEW, 'ARTICLE_SUBMITTED', traceId, async (tx, article) => {
      const version = await tx.articleVersion.findFirst({
        where: { articleId: article.id, publishedAt: null },
        orderBy: { versionNumber: 'desc' },
        select: { title: true, content: true },
      });
      if (!version || version.title.trim().length < 3 || version.content.trim().length === 0) {
        throw new AppError('The article needs a title and content before review', 422, AppErrorCode.VALIDATION_ERROR);
      }
      return { submittedAt: new Date() };
    });
  }

  withdraw(actor: Actor, ctx: TenantContext, id: string, traceId?: string) {
    return this.move(actor, ctx, id, ContentStatus.DRAFT, 'ARTICLE_WITHDRAWN', traceId);
  }

  archive(actor: Actor, ctx: TenantContext, id: string, traceId?: string) {
    return this.move(actor, ctx, id, ContentStatus.ARCHIVED, 'ARTICLE_ARCHIVED', traceId, async (_tx, article) => {
      if (article.status === ContentStatus.SUSPENDED) {
        throw new AppError('A suspended article can only be archived by an administrator', 403, AppErrorCode.FORBIDDEN);
      }
      return {};
    });
  }

  private async move(
    actor: Actor,
    ctx: TenantContext,
    id: string,
    target: ContentStatus,
    action: string,
    traceId: string | undefined,
    prepare?: (tx: Prisma.TransactionClient, article: Article) => Promise<Prisma.ArticleUpdateInput>,
  ) {
    const tenantId = this.requireMember(ctx);
    const result = await this.prisma.$transaction(async (tx) => {
      const article = await this.lockOwned(tx, ctx, actor, id, tenantId);
      if (article.status === target) {
        return { article, changed: false };
      }
      assertContentTransition(article.status, target);
      const extra = prepare ? await prepare(tx, article) : {};
      const updated = await tx.article.update({
        where: { id },
        data: { status: target, ...extra },
        select: summarySelect,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.role,
          tenantId,
          action,
          entityType: 'Article',
          entityId: id,
          before: { status: article.status },
          after: { status: updated.status },
          traceId,
        },
        tx,
      );
      return { article: updated, changed: true };
    });
    return { message: result.changed ? 'Article updated' : 'Article already in the requested state', data: result.article };
  }

  private requireMember(ctx: TenantContext): string {
    if (ctx.isPlatformAdmin || !ctx.tenantId) {
      throw new AppError('A tenant membership is required', 403, AppErrorCode.TENANT_ACCESS_DENIED);
    }
    return ctx.tenantId;
  }

  private ownOnly(ctx: TenantContext): boolean {
    return !(ctx.tenantRole && MANAGING_ROLES.includes(ctx.tenantRole));
  }

  private async lockOwned(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    actor: Actor,
    id: string,
    tenantId: string,
  ): Promise<Article> {
    await tx.$queryRaw`SELECT id FROM "Article" WHERE id = ${id} FOR UPDATE`;
    const article = await tx.article.findFirst({ where: { id, tenantId } });
    if (!article) {
      throw new AppError('Article not found', 404, AppErrorCode.NOT_FOUND);
    }
    if (article.authorId !== actor.id && this.ownOnly(ctx)) {
      throw new AppError('Only the author or a tenant manager can change this article', 403, AppErrorCode.OWNERSHIP_DENIED);
    }
    return article;
  }

  private resolvePrice(accessType: ProductAccessType, input: string | number | undefined): Prisma.Decimal | null {
    if (accessType === ProductAccessType.FREE) {
      if (input !== undefined) {
        throw new AppError('A free article cannot have a price', 422, AppErrorCode.VALIDATION_ERROR);
      }
      return null;
    }
    if (input === undefined) {
      throw new AppError('A paid article needs a price', 422, AppErrorCode.VALIDATION_ERROR);
    }
    const price = money(input);
    if (price.lessThanOrEqualTo(0)) {
      throw new AppError('The price must be greater than zero', 422, AppErrorCode.VALIDATION_ERROR);
    }
    return price;
  }

  private async assertCategory(categoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) {
      throw new AppError('Category not found', 404, AppErrorCode.NOT_FOUND);
    }
  }

  private async uniqueSlug(tx: Prisma.TransactionClient, tenantId: string, base: string): Promise<string> {
    const root = base && base.length >= 3 ? base.slice(0, 70) : `article-${Date.now().toString(36)}`;
    const taken = new Set(
      (
        await tx.article.findMany({
          where: { tenantId, slug: { startsWith: root } },
          select: { slug: true },
        })
      ).map((row) => row.slug),
    );
    if (!taken.has(root)) return root;
    for (let n = 2; n < 1000; n += 1) {
      const candidate = `${root}-${n}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${root}-${Date.now().toString(36)}`;
  }

  private async translateConflict<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new AppError('This slug is already used in your tenant', 409, AppErrorCode.UNIQUE_CONSTRAINT_FAILED);
      }
      throw error;
    }
  }
}
