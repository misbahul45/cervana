import { extendApi } from "@anatine/zod-openapi";
import { OrderStatus } from "@prisma/client";
import z from "zod";

export const CreateOrderDto = extendApi(
  z.object({
    userId: z.string().uuid().describe("ID of the user placing the order"),
    topicId: z.string().uuid().describe("ID of the topic being purchased"),
    amount: z.number().describe("Total amount of the order"),
    status: z
      .nativeEnum(OrderStatus)
      .default(OrderStatus.PENDING)
      .describe("Order status, defaults to PENDING"),
    currency: z
      .string()
      .default("IDR")
      .describe("Currency of the transaction, defaults to IDR"),
    gateway: z
      .string()
      .optional()
      .describe("Payment gateway used (e.g., midtrans, stripe, etc.)"),
    snapToken: z
      .string()
      .optional()
      .describe("Payment gateway snap token (e.g., from Midtrans)"),
    expiredAt: z
      .coerce.date()
      .describe("Datetime when the order expires (usually 1 hour after creation)"),
  }),
  {
    title: "CreateOrderRequest",
    example: {
      userId: "c1234567-89ab-4cde-f012-3456789abcde",
      topicId: "d2345678-90cd-4ef1-2345-6789abcdef01",
      amount: 150000,
      status: "PENDING",
      currency: "IDR",
      gateway: "midtrans",
      snapToken: "f6789012-34cd-4ef5-6789-abcdef012345",
      expiredAt: "2025-11-13T10:00:00.000Z",
    },
  }
);

export type CreateOrderDtoType = z.infer<typeof CreateOrderDto>;

export const UpdateOrderDto = extendApi(
  z.object({
    status: z
      .nativeEnum(OrderStatus)
      .optional()
      .describe("Updated order status (e.g., PAID, CANCELED, EXPIRED)"),
    snapToken: z
      .string()
      .uuid()
      .optional()
      .describe("Payment gateway snap token (e.g., from Midtrans)"),
    gateway: z
      .string()
      .optional()
      .describe("Payment gateway name (e.g., midtrans, stripe, etc.)"),
    paidAt: z
      .coerce.date()
      .optional()
      .describe("Datetime when the payment was completed"),
    expiredAt: z
      .coerce.date()
      .optional()
      .describe("New expiration datetime if extended"),
  }),
  {
    title: "UpdateOrderRequest",
    example: {
      status: "PAID",
      snapToken: "f6789012-34cd-4ef5-6789-abcdef012345",
      gateway: "midtrans",
      paidAt: "2025-11-13T11:15:00.000Z",
    },
  }
);

export type UpdateOrderDtoType = z.infer<typeof UpdateOrderDto>;
