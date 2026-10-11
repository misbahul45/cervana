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

export function orderItemLink(item: OrderItemView): string | null {
  if (item.articleId) return `/marketplace/articles/${item.articleId}`;
  if (item.classId) return `/marketplace/classes/${item.classId}`;
  return null;
}

export type OrderNext =
  | { kind: 'pay'; to: string; label: string }
  | { kind: 'verifying'; message: string }
  | { kind: 'open'; message: string }
  | { kind: 'closed'; message: string };

export function orderNext(order: { id: string; status: string; payment: unknown | null }): OrderNext {
  if (order.status === 'PENDING' && order.payment) {
    return { kind: 'pay', to: `/learn/orders/${order.id}/pay`, label: 'Lanjutkan pembayaran' };
  }
  if (order.status === 'PAYMENT_SUBMITTED') {
    return { kind: 'verifying', message: 'Bukti pembayaranmu sedang diverifikasi admin.' };
  }
  if (order.status === 'PAID' || order.status === 'FULFILLED') {
    return { kind: 'open', message: 'Pembayaran terverifikasi. Akses sudah terbuka.' };
  }
  return { kind: 'closed', message: 'Pesanan ini sudah tidak aktif.' };
}

export type TopicOrderState =
  | { kind: 'owned'; orderId: string }
  | { kind: 'open'; orderId: string; next: 'pay' | 'verify' }
  | { kind: 'new' };

export function topicOrderState(
  orders: ReadonlyArray<{ id: string; status: string; payment: unknown | null; items: ReadonlyArray<{ topicId: string | null }> }>,
  topicId: string,
): TopicOrderState {
  const forTopic = orders.filter((order) => order.items.some((item) => item.topicId === topicId));
  const owned = forTopic.find((order) => order.status === 'PAID' || order.status === 'FULFILLED');
  if (owned) return { kind: 'owned', orderId: owned.id };
  const open = forTopic.find((order) => (order.status === 'PENDING' && order.payment) || order.status === 'PAYMENT_SUBMITTED');
  if (open) return { kind: 'open', orderId: open.id, next: open.status === 'PENDING' ? 'pay' : 'verify' };
  return { kind: 'new' };
}
