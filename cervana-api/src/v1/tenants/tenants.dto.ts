import z from 'zod';
import { TenantStatus } from '@prisma/client';

export const UpdateTenantDto = z
  .object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(2000).optional(),
    logo: z.object({ url: z.string().url(), fileId: z.string().optional() }).optional(),
  })
  .strict();

export type UpdateTenantType = z.infer<typeof UpdateTenantDto>;

export const TenantReasonDto = z
  .object({ reason: z.string().min(3).max(500) })
  .strict();

export type TenantReasonType = z.infer<typeof TenantReasonDto>;

export const TenantListQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.nativeEnum(TenantStatus).optional(),
  q: z.string().max(100).optional(),
});

export type TenantListQueryType = z.infer<typeof TenantListQueryDto>;
