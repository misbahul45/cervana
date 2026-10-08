import { ordersApi } from '~/lib/api';
import { describeApiError, isApiError } from '~/lib/api-error';

export function usePurchase(type: 'ARTICLE' | 'CLASS', productId: () => string) {
  const user = useState<{ id: string } | null>('user', () => null);
  const idempotency = useIdempotencyKey();
  const buying = ref(false);
  const error = ref<string | null>(null);

  async function buy() {
    if (buying.value) return;
    if (!user.value) {
      await navigateTo('/login');
      return;
    }
    buying.value = true;
    error.value = null;
    try {
      const order = await ordersApi.create([{ type, id: productId() }], idempotency.current());
      idempotency.reset();
      await navigateTo(order.status === 'PENDING' && order.payment ? `/learn/orders/${order.id}/pay` : `/learn/orders/${order.id}`);
    } catch (err) {
      if (isApiError(err) && err.kind === 'unauthorized') {
        await navigateTo('/login');
        return;
      }
      error.value = describeApiError(err, 'Tidak bisa membuat pesanan. Coba lagi.');
    } finally {
      buying.value = false;
    }
  }

  return { buy, buying, error };
}
