import { PaymentIntentStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';

export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentIntentStatus, readonly PaymentIntentStatus[]>> = {
  [PaymentIntentStatus.CREATED]: [
    PaymentIntentStatus.PENDING,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.EXPIRED,
    PaymentIntentStatus.CANCELLED,
  ],
  [PaymentIntentStatus.PENDING]: [
    PaymentIntentStatus.SUBMITTED,
    PaymentIntentStatus.PROCESSING,
    PaymentIntentStatus.PAID,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.EXPIRED,
    PaymentIntentStatus.CANCELLED,
  ],
  [PaymentIntentStatus.SUBMITTED]: [
    PaymentIntentStatus.PAID,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.PENDING,
  ],
  [PaymentIntentStatus.PROCESSING]: [
    PaymentIntentStatus.PAID,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.PENDING,
  ],
  [PaymentIntentStatus.PAID]: [PaymentIntentStatus.REFUND_PENDING],
  [PaymentIntentStatus.FAILED]: [],
  [PaymentIntentStatus.EXPIRED]: [],
  [PaymentIntentStatus.CANCELLED]: [],
  [PaymentIntentStatus.REFUND_PENDING]: [PaymentIntentStatus.REFUNDED, PaymentIntentStatus.PAID],
  [PaymentIntentStatus.REFUNDED]: [],
};

export const PAYMENT_TERMINAL_STATES: readonly PaymentIntentStatus[] = [
  PaymentIntentStatus.FAILED,
  PaymentIntentStatus.EXPIRED,
  PaymentIntentStatus.CANCELLED,
  PaymentIntentStatus.REFUNDED,
];

export const PAYMENT_OPEN_STATES: readonly PaymentIntentStatus[] = [
  PaymentIntentStatus.CREATED,
  PaymentIntentStatus.PENDING,
  PaymentIntentStatus.SUBMITTED,
  PaymentIntentStatus.PROCESSING,
];

export function canTransitionPayment(from: PaymentIntentStatus, to: PaymentIntentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export function assertPaymentTransition(from: PaymentIntentStatus, to: PaymentIntentStatus): void {
  if (!canTransitionPayment(from, to)) {
    throw new AppError(
      `Payment cannot move from ${from} to ${to}`,
      409,
      AppErrorCode.INVALID_STATE_TRANSITION,
    );
  }
}
