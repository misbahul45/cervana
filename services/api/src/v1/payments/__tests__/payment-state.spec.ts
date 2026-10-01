import { PaymentIntentStatus } from '@prisma/client';
import {
  assertPaymentTransition,
  canTransitionPayment,
  PAYMENT_OPEN_STATES,
  PAYMENT_TERMINAL_STATES,
} from '../payment-state';

describe('payment state machine', () => {
  const allowed: Array<[PaymentIntentStatus, PaymentIntentStatus]> = [
    ['CREATED', 'PENDING'],
    ['CREATED', 'FAILED'],
    ['CREATED', 'EXPIRED'],
    ['CREATED', 'CANCELLED'],
    ['PENDING', 'SUBMITTED'],
    ['PENDING', 'PROCESSING'],
    ['PENDING', 'PAID'],
    ['PENDING', 'FAILED'],
    ['PENDING', 'EXPIRED'],
    ['PENDING', 'CANCELLED'],
    ['SUBMITTED', 'PAID'],
    ['SUBMITTED', 'FAILED'],
    ['SUBMITTED', 'PENDING'],
    ['PROCESSING', 'PAID'],
    ['PROCESSING', 'FAILED'],
    ['PROCESSING', 'PENDING'],
    ['PAID', 'REFUND_PENDING'],
    ['REFUND_PENDING', 'REFUNDED'],
    ['REFUND_PENDING', 'PAID'],
  ];

  it.each(allowed)('allows %s -> %s', (from, to) => {
    expect(canTransitionPayment(from, to)).toBe(true);
    expect(() => assertPaymentTransition(from, to)).not.toThrow();
  });

  const statuses = Object.values(PaymentIntentStatus);
  const forbidden = statuses.flatMap((from) =>
    statuses
      .filter((to) => !allowed.some(([f, t]) => f === from && t === to))
      .map((to): [PaymentIntentStatus, PaymentIntentStatus] => [from, to]),
  );

  it.each(forbidden)('rejects %s -> %s', (from, to) => {
    expect(canTransitionPayment(from, to)).toBe(false);
    expect(() => assertPaymentTransition(from, to)).toThrow(/cannot move/);
  });

  it('never leaves a terminal state', () => {
    for (const terminal of PAYMENT_TERMINAL_STATES) {
      for (const to of statuses) {
        expect(canTransitionPayment(terminal, to)).toBe(false);
      }
    }
  });

  it('only a verified payment can be refunded', () => {
    for (const from of PAYMENT_OPEN_STATES) {
      expect(canTransitionPayment(from, 'REFUND_PENDING')).toBe(false);
      expect(canTransitionPayment(from, 'REFUNDED')).toBe(false);
    }
  });

  it('allows both the manual path and a direct gateway path to reach PAID', () => {
    expect(canTransitionPayment('SUBMITTED', 'PAID')).toBe(true);
    expect(canTransitionPayment('PENDING', 'PAID')).toBe(true);
    expect(canTransitionPayment('PROCESSING', 'PAID')).toBe(true);
  });

  it('does not allow a payment to be paid twice or to skip creation', () => {
    expect(canTransitionPayment('PAID', 'PAID')).toBe(false);
    expect(canTransitionPayment('CREATED', 'PAID')).toBe(false);
    expect(canTransitionPayment('CREATED', 'SUBMITTED')).toBe(false);
  });
});
