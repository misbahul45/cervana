import { extendApi } from '@anatine/zod-openapi';
import { ManualPaymentStatus } from '@prisma/client';
import z from 'zod';

export const SubmitManualPaymentDto = extendApi(
  z
    .object({
      paymentMethod: z.string().min(2).max(40).regex(/^[A-Z0-9_]+$/),
      referenceNumber: z.string().min(3).max(64).optional(),
      proof: z
        .object({
          url: z.string().url().startsWith('https://').max(600),
          fileId: z.string().min(3).max(300),
        })
        .strict(),
      note: z.string().max(500).optional(),
    })
    .strict(),
  {
    title: 'SubmitManualPaymentRequest',
    example: {
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TRX-20260930-001',
      proof: { url: 'https://res.cloudinary.com/demo/image/upload/images/user-proof.png', fileId: 'images/user-proof' },
      note: 'Transfer from my personal account',
    },
  },
);
export type SubmitManualPaymentDtoType = z.infer<typeof SubmitManualPaymentDto>;

export const ApproveManualPaymentDto = extendApi(
  z.object({ reason: z.string().min(3).max(500) }).strict(),
  { title: 'ApproveManualPaymentRequest', example: { reason: 'Transfer matches the bank statement' } },
);
export type ApproveManualPaymentDtoType = z.infer<typeof ApproveManualPaymentDto>;

export const RejectManualPaymentDto = extendApi(
  z
    .object({
      reason: z.string().min(3).max(500),
      allowResubmit: z.boolean().default(true),
    })
    .strict(),
  { title: 'RejectManualPaymentRequest', example: { reason: 'Proof is unreadable', allowResubmit: true } },
);
export type RejectManualPaymentDtoType = z.infer<typeof RejectManualPaymentDto>;

export const ManualQueueQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(ManualPaymentStatus).optional(),
});
export type ManualQueueQueryDtoType = z.infer<typeof ManualQueueQueryDto>;
