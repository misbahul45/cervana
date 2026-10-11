import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { gamifyApi } from '~/lib/api';
import { QK } from '~/lib/query-keys';

const STALE_MS = 30_000;

export function useGamifyMe() {
  const user = useState('user');
  return useQuery({
    queryKey: QK.gamify.me(),
    queryFn: () => gamifyApi.me(),
    staleTime: STALE_MS,
    enabled: computed(() => Boolean(user.value)),
  });
}

export function useAchievements() {
  return useQuery({ queryKey: QK.gamify.achievements(), queryFn: () => gamifyApi.achievements(), staleTime: STALE_MS });
}

export function useTopicBoard(topicId: MaybeRefOrGetter<string | null | undefined>) {
  return useQuery({
    queryKey: computed(() => QK.gamify.board(toValue(topicId) ?? '')),
    queryFn: () => gamifyApi.topicBoard(toValue(topicId) as string),
    enabled: computed(() => Boolean(toValue(topicId))),
    staleTime: STALE_MS,
  });
}

export function useBoardMembership() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { optIn?: boolean; handle?: string }) => gamifyApi.updateBoardMembership(body),
    onSuccess: async (response) => {
      if (!response.success) return;
      await Promise.all([client.invalidateQueries({ queryKey: QK.gamify.me() }), client.invalidateQueries({ queryKey: ['gamify', 'board'] })]);
    },
  });
}

export function refreshGamify() {
  const client = useQueryClient();
  return Promise.all([client.invalidateQueries({ queryKey: QK.gamify.me() }), client.invalidateQueries({ queryKey: QK.gamify.achievements() })]);
}
