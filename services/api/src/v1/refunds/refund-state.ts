import { RefundStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';

export const REFUND_TRANSITIONS: Readonly<Record<RefundStatus, readonly RefundStatus[]>> = {
  [RefundStatus.REQUESTED]: [RefundStatus.APPROVED, RefundStatus.REJECTED],
  [RefundStatus.APPROVED]: [RefundStatus.PROCESSED, RefundStatus.REJECTED],
  [RefundStatus.PROCESSED]: [],
  [RefundStatus.REJECTED]: [],
};

export const REFUND_OPEN_STATES: readonly RefundStatus[] = [RefundStatus.REQUESTED, RefundStatus.APPROVED];

export function canTransitionRefund(from: RefundStatus, to: RefundStatus): boolean {
  return REFUND_TRANSITIONS[from].includes(to);
}

export function assertRefundTransition(from: RefundStatus, to: RefundStatus): void {
  if (!canTransitionRefund(from, to)) {
    throw new AppError(`Refund cannot move from ${from} to ${to}`, 409, AppErrorCode.INVALID_STATE_TRANSITION);
  }
}
