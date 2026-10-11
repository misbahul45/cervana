import { computed, watch } from 'vue';
import { lessonIdFrom } from '~/lib/lesson-id';
import { useLearning } from '~/stores/learning';

export function useLessonId() {
  const route = useRoute();
  const learning = useLearning();
  const lessonId = computed(() => lessonIdFrom(route.query.lessonId, learning.lessonId));

  watch(
    lessonId,
    (value) => {
      if (value && value !== learning.lessonId) learning.setLesson(value);
    },
    { immediate: true },
  );

  return lessonId;
}
