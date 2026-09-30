import { PayoutStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';

export const PAYOUT_TRANSITIONS: Readonly<Record<PayoutStatus, readonly PayoutStatus[]>> = {
  [PayoutStatus.REQUESTED]: [PayoutStatus.UNDER_REVIEW, PayoutStatus.APPROVED, PayoutStatus.REJECTED, PayoutStatus.CANCELLED],
  [PayoutStatus.UNDER_REVIEW]: [PayoutStatus.APPROVED, PayoutStatus.REJECTED],
  [PayoutStatus.APPROVED]: [PayoutStatus.PAID, PayoutStatus.REJECTED],
  [PayoutStatus.PAID]: [],
  [PayoutStatus.REJECTED]: [],
  [PayoutStatus.CANCELLED]: [],
};

export const PAYOUT_OPEN_STATES: readonly PayoutStatus[] = [
  PayoutStatus.REQUESTED,
  PayoutStatus.UNDER_REVIEW,
  PayoutStatus.APPROVED,
];

export function canTransitionPayout(from: PayoutStatus, to: PayoutStatus): boolean {
  return PAYOUT_TRANSITIONS[from].includes(to);
}

export function assertPayoutTransition(from: PayoutStatus, to: PayoutStatus): void {
  if (!canTransitionPayout(from, to)) {
    throw new AppError(`Payout cannot move from ${from} to ${to}`, 409, AppErrorCode.INVALID_STATE_TRANSITION);
  }
}
