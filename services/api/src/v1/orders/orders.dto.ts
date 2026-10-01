import { extendApi } from '@anatine/zod-openapi';
import { OrderStatus } from '@prisma/client';
import z from 'zod';

export const ORDER_ITEM_KINDS = ['TOPIC', 'ARTICLE', 'CLASS'] as const;
export type OrderItemKind = (typeof ORDER_ITEM_KINDS)[number];

export const OrderItemRequestDto = z
  .object({
    type: z.enum(ORDER_ITEM_KINDS).describe('Kind of product being purchased'),
    id: z.string().uuid().describe('ID of the product being purchased'),
  })
  .strict();

export const CreateOrderRequestDto = extendApi(
  z
    .object({
      topicId: z.string().uuid().optional().describe('Legacy shortcut for a single topic purchase'),
      items: z.array(OrderItemRequestDto).min(1).max(10).optional(),
      paymentMethod: z
        .string()
        .min(2)
        .max(40)
        .regex(/^[A-Z0-9_]+$/)
        .optional()
        .describe('Payment method offered by the active payment provider'),
    })
    .superRefine((value, ctx) => {
      if (!value.topicId && !value.items) {
        ctx.addIssue({ code: 'custom', message: 'Provide topicId or items', path: ['items'] });
      }
      if (value.topicId && value.items) {
        ctx.addIssue({ code: 'custom', message: 'Provide either topicId or items, not both', path: ['items'] });
      }
    }),
  {
    title: 'CreateOrderRequest',
    example: {
      items: [{ type: 'ARTICLE', id: 'd2345678-90cd-4ef1-2345-6789abcdef01' }],
      paymentMethod: 'BANK_TRANSFER',
    },
  },
);

export type CreateOrderRequestDtoType = z.infer<typeof CreateOrderRequestDto>;

export const OrderListQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  topicId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  sort: z
    .string()
    .regex(/^(createdAt|total|status|paidAt):(asc|desc)$/)
    .optional(),
  include: z.enum(['topic']).optional(),
});

export type OrderListQueryDtoType = z.infer<typeof OrderListQueryDto>;
