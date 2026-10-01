import { extendApi } from '@anatine/zod-openapi';
import { ClassDifficulty, ClassFormat, ContentStatus } from '@prisma/client';
import z from 'zod';
import { partialWithoutDefaults } from '@/common/lib/zod-partial';
import { AccessTypeDto, PaginationDto, PriceDto, SlugDto, UploadedImageDto } from '../marketplace/marketplace.dto';

const HttpsUrl = z.string().url().startsWith('https://').max(600);

const ClassBase = z
  .object({
    title: z.string().min(3).max(160),
    slug: SlugDto.optional(),
    description: z.string().max(20000).optional(),
    coverImage: UploadedImageDto.optional(),
    accessType: AccessTypeDto.default('FREE'),
    price: PriceDto.optional(),
    format: z.nativeEnum(ClassFormat).default('LIVE'),
    difficulty: z.nativeEnum(ClassDifficulty).default('BEGINNER'),
    durationMinutes: z.number().int().min(5).max(6000).optional(),
    capacity: z.number().int().min(1).max(100000).optional(),
  })
  .strict();

export const CreateClassDto = extendApi(ClassBase, {
  title: 'CreateClassRequest',
  example: { title: 'Kelas laporan keuangan', accessType: 'PAID', price: 150000, format: 'LIVE', capacity: 30 },
});
export type CreateClassDtoType = z.infer<typeof ClassBase>;

export const UpdateClassDto = partialWithoutDefaults(ClassBase).strict();
export type UpdateClassDtoType = z.infer<typeof UpdateClassDto>;

const SessionBase = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    meetingUrl: HttpsUrl.optional(),
    recordingUrl: HttpsUrl.optional(),
  })
  .strict();

export const CreateSessionDto = SessionBase.refine((value) => value.endsAt > value.startsAt, {
  message: 'endsAt must be after startsAt',
  path: ['endsAt'],
});
export type CreateSessionDtoType = z.infer<typeof SessionBase>;

export const UpdateSessionDto = SessionBase.partial().strict();
export type UpdateSessionDtoType = z.infer<typeof UpdateSessionDto>;

export const TeacherClassQueryDto = PaginationDto.extend({
  status: z.nativeEnum(ContentStatus).optional(),
});
export type TeacherClassQueryDtoType = z.infer<typeof TeacherClassQueryDto>;

export const AdminClassQueryDto = PaginationDto.extend({
  status: z.nativeEnum(ContentStatus).default(ContentStatus.PENDING_REVIEW),
  tenantId: z.string().uuid().optional(),
});
export type AdminClassQueryDtoType = z.infer<typeof AdminClassQueryDto>;

export const MarketplaceClassQueryDto = PaginationDto.extend({
  q: z.string().trim().min(1).max(100).optional(),
  tenantId: z.string().uuid().optional(),
  accessType: AccessTypeDto.optional(),
  format: z.nativeEnum(ClassFormat).optional(),
  difficulty: z.nativeEnum(ClassDifficulty).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'title']).default('newest'),
});
export type MarketplaceClassQueryDtoType = z.infer<typeof MarketplaceClassQueryDto>;

export const EnrollmentListQueryDto = PaginationDto.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type EnrollmentListQueryDtoType = z.infer<typeof EnrollmentListQueryDto>;
