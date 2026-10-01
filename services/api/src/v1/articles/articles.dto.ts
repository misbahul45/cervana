import { extendApi } from '@anatine/zod-openapi';
import { ContentStatus } from '@prisma/client';
import z from 'zod';
import { partialWithoutDefaults } from '@/common/lib/zod-partial';
import { AccessTypeDto, PaginationDto, PriceDto, SlugDto, UploadedImageDto } from '../marketplace/marketplace.dto';

const ArticleBase = z
  .object({
    title: z.string().min(3).max(160),
    slug: SlugDto.optional(),
    excerpt: z.string().max(500).optional(),
    coverImage: UploadedImageDto.optional(),
    categoryId: z.string().uuid().optional(),
    accessType: AccessTypeDto.default('FREE'),
    price: PriceDto.optional(),
    content: z.string().min(1).max(200000),
  })
  .strict();

export const CreateArticleDto = extendApi(ArticleBase, {
  title: 'CreateArticleRequest',
  example: {
    title: 'Memahami jurnal penyesuaian',
    excerpt: 'Ringkasan cara menyusun jurnal penyesuaian.',
    accessType: 'PAID',
    price: 25000,
    content: '# Jurnal penyesuaian\n...',
  },
});
export type CreateArticleDtoType = z.infer<typeof ArticleBase>;

export const UpdateArticleDto = partialWithoutDefaults(ArticleBase).strict();
export type UpdateArticleDtoType = z.infer<typeof UpdateArticleDto>;

export const TeacherArticleQueryDto = PaginationDto.extend({
  status: z.nativeEnum(ContentStatus).optional(),
});
export type TeacherArticleQueryDtoType = z.infer<typeof TeacherArticleQueryDto>;

export const AdminArticleQueryDto = PaginationDto.extend({
  status: z.nativeEnum(ContentStatus).default(ContentStatus.PENDING_REVIEW),
  tenantId: z.string().uuid().optional(),
});
export type AdminArticleQueryDtoType = z.infer<typeof AdminArticleQueryDto>;

export const MarketplaceArticleQueryDto = PaginationDto.extend({
  q: z.string().trim().min(1).max(100).optional(),
  categoryId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  accessType: AccessTypeDto.optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'title']).default('newest'),
});
export type MarketplaceArticleQueryDtoType = z.infer<typeof MarketplaceArticleQueryDto>;
