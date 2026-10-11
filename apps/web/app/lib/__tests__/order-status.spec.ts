import { describe, expect, it } from 'vitest';
import type { OrderItemView } from '~/interfaces/commerce';
import { orderItemLink, orderNext, orderStatusMeta, orderTitle, topicOrderState } from '~/lib/order-status';

const item = (overrides: Partial<OrderItemView>): OrderItemView => ({
  id: 'i1',
  quantity: 1,
  unitPrice: '1000',
  totalPrice: '1000',
  articleId: null,
  classId: null,
  topicId: null,
  ...overrides,
});

describe('orderStatusMeta', () => {
  it('maps every status the API can return to a label and tone', () => {
    for (const status of ['PENDING', 'PAYMENT_SUBMITTED', 'PAID', 'FULFILLED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED']) {
      expect(orderStatusMeta(status).label.length).toBeGreaterThan(0);
    }
  });

  it('does not hide a status it does not know', () => {
    expect(orderStatusMeta('SOMETHING_NEW')).toEqual({ label: 'SOMETHING_NEW', tone: 'neutral' });
  });

  it('never presents a pending payment as paid', () => {
    expect(orderStatusMeta('PENDING').tone).not.toBe('success');
    expect(orderStatusMeta('PAYMENT_SUBMITTED').label).not.toMatch(/dibayar|selesai/i);
  });
});

describe('orderTitle', () => {
  it('uses the product title from the first item', () => {
    expect(orderTitle([item({ article: { title: 'Jurnal Umum' } })])).toBe('Jurnal Umum');
    expect(orderTitle([item({ classProduct: { title: 'Kelas Dasar' } })])).toBe('Kelas Dasar');
  });

  it('summarises multi-item orders', () => {
    expect(orderTitle([item({ article: { title: 'A' } }), item({ id: 'i2' }), item({ id: 'i3' })])).toBe('A +2 lainnya');
  });

  it('falls back safely when there are no items', () => {
    expect(orderTitle([])).toBe('Pesanan');
  });
});


describe('orderItemLink', () => {
  it('opens the article or class that was bought', () => {
    expect(orderItemLink(item({ articleId: 'a1' }))).toBe('/marketplace/articles/a1');
    expect(orderItemLink(item({ classId: 'c1' }))).toBe('/marketplace/classes/c1');
  });

  it('has no link for a topic item', () => {
    expect(orderItemLink(item({ topicId: 't1' }))).toBeNull();
  });
});

describe('orderNext', () => {
  it('sends a pending order with a payment to the payment page', () => {
    expect(orderNext({ id: 'o1', status: 'PENDING', payment: {} })).toEqual({ kind: 'pay', to: '/learn/orders/o1/pay', label: 'Lanjutkan pembayaran' });
  });

  it('says the proof is being verified once submitted', () => {
    expect(orderNext({ id: 'o1', status: 'PAYMENT_SUBMITTED', payment: {} }).kind).toBe('verifying');
  });

  it('says access is open for a paid or fulfilled order', () => {
    expect(orderNext({ id: 'o1', status: 'PAID', payment: null }).kind).toBe('open');
    expect(orderNext({ id: 'o1', status: 'FULFILLED', payment: null }).kind).toBe('open');
  });

  it('treats everything else as closed, including a pending order without a payment', () => {
    expect(orderNext({ id: 'o1', status: 'PENDING', payment: null }).kind).toBe('closed');
    expect(orderNext({ id: 'o1', status: 'EXPIRED', payment: null }).kind).toBe('closed');
    expect(orderNext({ id: 'o1', status: 'REFUNDED', payment: null }).kind).toBe('closed');
  });
});


describe('topicOrderState', () => {
  const order = (id: string, status: string, topicId: string | null, payment: unknown | null = {}) => ({
    id,
    status,
    payment,
    items: [{ topicId }],
  });

  it('is new when the user never ordered this topic', () => {
    expect(topicOrderState([], 't1')).toEqual({ kind: 'new' });
    expect(topicOrderState([order('o1', 'PENDING', 't2')], 't1')).toEqual({ kind: 'new' });
  });

  it('is owned once an order for the topic is paid or fulfilled', () => {
    expect(topicOrderState([order('o1', 'FULFILLED', 't1')], 't1')).toEqual({ kind: 'owned', orderId: 'o1' });
    expect(topicOrderState([order('o1', 'PAID', 't1', null)], 't1').kind).toBe('owned');
  });

  it('prefers owned over an older open order', () => {
    const state = topicOrderState([order('o1', 'PENDING', 't1'), order('o2', 'PAID', 't1')], 't1');

    expect(state).toEqual({ kind: 'owned', orderId: 'o2' });
  });

  it('continues an open order instead of creating a second one', () => {
    expect(topicOrderState([order('o1', 'PENDING', 't1')], 't1')).toEqual({ kind: 'open', orderId: 'o1', next: 'pay' });
    expect(topicOrderState([order('o1', 'PAYMENT_SUBMITTED', 't1')], 't1')).toEqual({ kind: 'open', orderId: 'o1', next: 'verify' });
  });

  it('ignores cancelled, expired and refunded orders', () => {
    for (const status of ['CANCELLED', 'EXPIRED', 'FAILED', 'REFUNDED', 'REFUND_PENDING']) {
      expect(topicOrderState([order('o1', status, 't1')], 't1')).toEqual({ kind: 'new' });
    }
  });
});
