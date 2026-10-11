import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { User } from '~/interfaces/auth';
import { claimOutcome, unlockAction } from '~/lib/topics';
import { ordersService } from '~/services/order';
import { ENROLLED_TOPICS_KEY, useEnrolledTopics } from '~/composables/useEnrolledTopics';

export interface UnlockableTopic {
  id: string;
  slug: string;
  price: number | null | undefined;
}

export function useTopicUnlock() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const user = useState<User | null>('user');
  const { ids } = useEnrolledTopics();

  const claim = useMutation({
    mutationFn: (topic: UnlockableTopic) => ordersService.create({ topicId: topic.id }),
    onSuccess: async (response, topic) => {
      const outcome = claimOutcome(response);
      if (outcome === 'opened') {
        await queryClient.invalidateQueries({ queryKey: [ENROLLED_TOPICS_KEY] });
        toast.add({ title: 'Topik terbuka', description: 'Selamat belajar!', color: 'success', icon: 'i-lucide-rocket' });
        await navigateTo(`/my-learning/topics/${topic.slug}`);
        return;
      }
      if (outcome === 'failed') {
        toast.add({ title: 'Gagal membuka topik', description: response?.message || 'Coba lagi sebentar lagi.', color: 'error' });
        return;
      }
      toast.add({ title: 'Topik belum terbuka', description: 'Selesaikan pesananmu untuk membukanya.', color: 'warning' });
      await navigateTo(`/learn/topics/${topic.id}/order`);
    },
    onError: () => {
      toast.add({ title: 'Gagal membuka topik', description: 'Coba lagi sebentar lagi.', color: 'error' });
    },
  });

  const hasAccess = (topicId: string) => ids.value.has(topicId);

  const open = async (topic: UnlockableTopic) => {
    const action = unlockAction({
      id: topic.id,
      slug: topic.slug,
      price: topic.price,
      signedIn: Boolean(user.value),
      hasAccess: hasAccess(topic.id),
    });
    if (action.kind === 'claim') {
      claim.mutate(topic);
      return;
    }
    await navigateTo(action.to);
  };

  return { hasAccess, open, pending: computed(() => claim.isPending.value) };
}
