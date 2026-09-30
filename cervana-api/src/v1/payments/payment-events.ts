import { PaymentProvider } from '@prisma/client';

export const PaymentEvents = {
  Created: 'PaymentCreated',
  Submitted: 'PaymentSubmitted',
  Verified: 'PaymentVerified',
  Failed: 'PaymentFailed',
  Expired: 'PaymentExpired',
  Cancelled: 'PaymentCancelled',
} as const;

export const RefundEvents = {
  Requested: 'RefundRequested',
  Approved: 'RefundApproved',
  Completed: 'RefundCompleted',
} as const;

export const PAYMENT_AGGREGATE = 'PaymentIntent';

export interface PaymentEventBase {
  paymentIntentId: string;
  orderId: string;
  provider: PaymentProvider;
  amount: string;
  currency: string;
}

export interface PaymentVerifiedPayload extends PaymentEventBase {
  transactionId: string;
  verifiedAt: string;
  verifiedBy: { kind: string; id: string | null };
}

export interface PaymentFailedPayload extends PaymentEventBase {
  reason: string | null;
}

export type PaymentCreatedPayload = PaymentEventBase;
export type PaymentSubmittedPayload = PaymentEventBase;
export type PaymentExpiredPayload = PaymentEventBase;
export type PaymentCancelledPayload = PaymentEventBase;

export const paymentEventKey = (type: string, paymentIntentId: string, discriminator?: string) =>
  discriminator ? `${type}:${paymentIntentId}:${discriminator}` : `${type}:${paymentIntentId}`;
