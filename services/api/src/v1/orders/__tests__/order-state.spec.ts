import { OrderStatus } from '@prisma/client';
import { assertTransition, canTransition } from '../order-state';

describe('order state machine', () => {
  const allowed: Array<[OrderStatus, OrderStatus]> = [
    ['PENDING', 'PAID'],
    ['PENDING', 'FAILED'],
    ['PENDING', 'CANCELLED'],
    ['PENDING', 'EXPIRED'],
    ['PAYMENT_SUBMITTED', 'PENDING'],
    ['PAYMENT_SUBMITTED', 'PAID'],
    ['PAYMENT_SUBMITTED', 'FAILED'],
    ['PAYMENT_SUBMITTED', 'CANCELLED'],
    ['PAID', 'FULFILLED'],
    ['PAID', 'REFUND_PENDING'],
    ['PAID', 'REFUNDED'],
    ['FULFILLED', 'REFUND_PENDING'],
    ['FULFILLED', 'REFUNDED'],
    ['REFUND_PENDING', 'REFUNDED'],
    ['REFUND_PENDING', 'FULFILLED'],
  ];

  it.each(allowed)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  const statuses = Object.values(OrderStatus);
  const forbidden = statuses.flatMap((from) =>
    statuses
      .filter((to) => !allowed.some(([f, t]) => f === from && t === to))
      .map((to): [OrderStatus, OrderStatus] => [from, to]),
  );

  it.each(forbidden)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(/cannot move/);
  });

  it('never leaves a terminal status', () => {
    for (const terminal of ['FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'] as OrderStatus[]) {
      for (const to of statuses) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
  });

  it('keeps payment sub-states out of the order lifecycle', () => {
    expect(canTransition('PENDING', 'PAYMENT_SUBMITTED')).toBe(false);
  });

  it('cannot be fulfilled without being paid first', () => {
    expect(canTransition('PENDING', 'FULFILLED')).toBe(false);
  });

  it('defines a transition row for every status', () => {
    for (const status of statuses) {
      expect(() => canTransition(status, 'PENDING')).not.toThrow();
    }
  });
});
