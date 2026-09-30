import { OrderStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PAID,
    OrderStatus.FAILED,
    OrderStatus.CANCELLED,
    OrderStatus.EXPIRED,
  ],
  [OrderStatus.PAYMENT_SUBMITTED]: [
    OrderStatus.PENDING,
    OrderStatus.PAID,
    OrderStatus.FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAID]: [OrderStatus.FULFILLED, OrderStatus.REFUND_PENDING, OrderStatus.REFUNDED],
  [OrderStatus.FULFILLED]: [OrderStatus.REFUND_PENDING, OrderStatus.REFUNDED],
  [OrderStatus.REFUND_PENDING]: [OrderStatus.REFUNDED, OrderStatus.FULFILLED],
  [OrderStatus.FAILED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.EXPIRED]: [],
  [OrderStatus.REFUNDED]: [],
};

export const ORDER_OPEN_STATES: readonly OrderStatus[] = [OrderStatus.PENDING];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(
      `Order cannot move from ${from} to ${to}`,
      409,
      AppErrorCode.INVALID_STATE_TRANSITION,
    );
  }
}
