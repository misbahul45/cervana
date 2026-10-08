import type { OrderItemView, OrderStatus } from '~/interfaces/commerce';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: 'Menunggu pembayaran', tone: 'warning' },
  PAYMENT_SUBMITTED: { label: 'Menunggu verifikasi', tone: 'info' },
  PAID: { label: 'Dibayar', tone: 'info' },
  FULFILLED: { label: 'Selesai', tone: 'success' },
  FAILED: { label: 'Gagal', tone: 'error' },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
  EXPIRED: { label: 'Kedaluwarsa', tone: 'neutral' },
  REFUND_PENDING: { label: 'Refund diproses', tone: 'warning' },
  REFUNDED: { label: 'Dikembalikan', tone: 'error' },
};

export function orderStatusMeta(status: string): { label: string; tone: StatusTone } {
  return ORDER_STATUS[status as OrderStatus] ?? { label: status, tone: 'neutral' };
}

export function orderItemTitle(item: OrderItemView): string {
  return item.article?.title ?? item.classProduct?.title ?? item.topic?.title ?? 'Produk';
}

export function orderTitle(items: OrderItemView[]): string {
  if (items.length === 0) return 'Pesanan';
  const [first, ...rest] = items;
  const title = orderItemTitle(first!);
  return rest.length === 0 ? title : `${title} +${rest.length} lainnya`;
}
