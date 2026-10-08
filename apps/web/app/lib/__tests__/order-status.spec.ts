import { describe, expect, it } from 'vitest';
import type { OrderItemView } from '~/interfaces/commerce';
import { orderStatusMeta, orderTitle } from '~/lib/order-status';

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
