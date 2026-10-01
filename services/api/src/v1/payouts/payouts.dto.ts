import { extendApi } from '@anatine/zod-openapi';
import { PayoutStatus } from '@prisma/client';
import z from 'zod';
import { PaginationDto, PriceDto, UploadedImageDto } from '../marketplace/marketplace.dto';

export const PayoutDestinationDto = z
  .object({
    bankName: z.string().min(2).max(80),
    accountNumber: z.string().regex(/^[0-9A-Za-z\-\s]{3,40}$/),
    accountName: z.string().min(2).max(120),
  })
  .strict();

export const RequestPayoutDto = extendApi(
  z
    .object({
      walletId: z.string().uuid().optional(),
      amount: PriceDto,
      destination: PayoutDestinationDto,
    })
    .strict(),
  {
    title: 'RequestPayoutRequest',
    example: { amount: 100000, destination: { bankName: 'BCA', accountNumber: '1234567890', accountName: 'Nama Kreator' } },
  },
);
export type RequestPayoutDtoType = z.infer<typeof RequestPayoutDto>;

export const MarkPaidDto = z
  .object({
    evidence: UploadedImageDto,
    note: z.string().min(3).max(500).optional(),
  })
  .strict();
export type MarkPaidDtoType = z.infer<typeof MarkPaidDto>;

export const PayoutQueryDto = PaginationDto.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(PayoutStatus).optional(),
});
export type PayoutQueryDtoType = z.infer<typeof PayoutQueryDto>;

export const AdminPayoutQueryDto = PayoutQueryDto.extend({
  tenantId: z.string().uuid().optional(),
});
export type AdminPayoutQueryDtoType = z.infer<typeof AdminPayoutQueryDto>;
