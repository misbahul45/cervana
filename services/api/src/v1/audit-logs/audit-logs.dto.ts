import { z } from 'zod';

const shortText = z.string().trim().min(1).max(100);

export const AuditLogQueryDto = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    action: shortText.optional(),
    entityType: shortText.optional(),
    entityId: shortText.optional(),
    actorId: z.string().uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, { message: 'from must not be after to', path: ['to'] });

export type AuditLogQueryType = z.infer<typeof AuditLogQueryDto>;
