import z from 'zod';
import { ProductAccessType } from '@prisma/client';

export const UploadedImageDto = z
  .object({
    url: z.string().url().startsWith('https://').max(600),
    fileId: z.string().min(3).max(300),
  })
  .strict();

export const PriceDto = z.union([
  z.number().positive().max(999999999),
  z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),
]);

export const SlugDto = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const PaginationDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const AccessTypeDto = z.nativeEnum(ProductAccessType);

export const ReasonDto = z.object({ reason: z.string().min(3).max(500) }).strict();
export type ReasonDtoType = z.infer<typeof ReasonDto>;

export const OptionalNoteDto = z.object({ note: z.string().min(3).max(500).optional() }).strict();
export type OptionalNoteDtoType = z.infer<typeof OptionalNoteDto>;
