import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { User } from '~/interfaces/auth';
import { collectEnrolledTopicIds } from '~/lib/topics';
import { userTopicService } from '~/services/learning/userTopic';

export const ENROLLED_TOPICS_KEY = 'enrolled-topic-ids';

const PAGE_SIZE = 100;
const STALE_MS = 60_000;

export function useEnrolledTopics() {
  const user = useState<User | null>('user');
  const query = useQuery({
    queryKey: computed(() => [ENROLLED_TOPICS_KEY, user.value?.id ?? null]),
    enabled: computed(() => Boolean(user.value)),
    staleTime: STALE_MS,
    queryFn: () =>
      collectEnrolledTopicIds(async (page) => {
        const response = await userTopicService.findAll({ page, limit: PAGE_SIZE });
        const body = response?.data;
        if (!body) return undefined;
        return { items: body.data ?? [], totalPages: body.pagination?.totalPages ?? 1 };
      }),
  });
  const ids = computed(() => new Set(query.data.value ?? []));
  return { ids, isLoading: query.isLoading };
}
