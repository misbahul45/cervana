import type { User } from '~/interfaces/auth';
import { resolveLearningIds, type LearningIds } from '~/lib/learning-ids';
import { lessonsService } from '~/services/curriculum/lessons';
import { userTopicService } from '~/services/learning/userTopic';
import { useLearning } from '~/stores/learning';

export function useLearningIds() {
  const learning = useLearning();
  const user = useState<User | null>('user');

  const ensure = async (lessonId: string): Promise<LearningIds> => {
    const ids = await resolveLearningIds(
      { topicId: learning.topicId, learningStyleId: learning.learningStyleId },
      { lessonId, userId: user.value?.id ?? '' },
      {
        topicIdOfLesson: async (id) => (await lessonsService.findOne<true>(id, { include: ['subTopic'] }))?.data?.subTopic?.topicId,
        learningStyleIdOf: async (userId, topicId) =>
          (await userTopicService.findAll<true>({ page: 1, limit: 1, userId, topicId, include: 'learningStyleProfile' }))?.data?.data?.[0]
            ?.learningStyleProfile?.id,
      },
    );
    if (ids.topicId && ids.topicId !== learning.topicId) learning.setTopic(ids.topicId);
    if (ids.learningStyleId && ids.learningStyleId !== learning.learningStyleId) learning.setLearningStyle(ids.learningStyleId);
    return ids;
  };

  return { ensure };
}
