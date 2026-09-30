import { extendApi } from '@anatine/zod-openapi';
import { RefundStatus } from '@prisma/client';
import z from 'zod';
import { PaginationDto, UploadedImageDto } from '../marketplace/marketplace.dto';

export const RequestRefundDto = extendApi(
  z.object({ reason: z.string().min(5).max(1000) }).strict(),
  { title: 'RequestRefundRequest', example: { reason: 'Saya membeli dua kali secara tidak sengaja' } },
);
export type RequestRefundDtoType = z.infer<typeof RequestRefundDto>;

export const AdminCreateRefundDto = z
  .object({ orderId: z.string().uuid(), reason: z.string().min(5).max(1000) })
  .strict();
export type AdminCreateRefundDtoType = z.infer<typeof AdminCreateRefundDto>;

export const ProcessRefundDto = z
  .object({ evidence: UploadedImageDto, note: z.string().min(3).max(500).optional() })
  .strict();
export type ProcessRefundDtoType = z.infer<typeof ProcessRefundDto>;

export const RefundQueryDto = PaginationDto.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(RefundStatus).optional(),
});
export type RefundQueryDtoType = z.infer<typeof RefundQueryDto>;
