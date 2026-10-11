import { describe, expect, it, vi } from 'vitest';
import { resolveLearningIds } from '~/lib/learning-ids';

const LESSON = '5787aef0-0df5-4395-a372-92c3b5dfec09';
const USER = 'c6c571d7-40ae-4998-9699-4803d04a0c57';
const TOPIC = 'f43bfce7-b141-4351-9723-989d972c35f0';
const STYLE = '496acf8a-3491-4f04-bb9a-7f9c66ff30be';

const sources = () => ({
  topicIdOfLesson: vi.fn().mockResolvedValue(TOPIC),
  learningStyleIdOf: vi.fn().mockResolvedValue(STYLE),
});

describe('resolveLearningIds', () => {
  it('keeps what the store already knows without calling the api', async () => {
    const s = sources();

    const ids = await resolveLearningIds({ topicId: TOPIC, learningStyleId: STYLE }, { lessonId: LESSON, userId: USER }, s);

    expect(ids).toEqual({ topicId: TOPIC, learningStyleId: STYLE });
    expect(s.topicIdOfLesson).not.toHaveBeenCalled();
    expect(s.learningStyleIdOf).not.toHaveBeenCalled();
  });

  it('rebuilds both ids from the lesson and the user after a hard page load', async () => {
    const s = sources();

    const ids = await resolveLearningIds({ topicId: '', learningStyleId: '' }, { lessonId: LESSON, userId: USER }, s);

    expect(ids).toEqual({ topicId: TOPIC, learningStyleId: STYLE });
    expect(s.topicIdOfLesson).toHaveBeenCalledWith(LESSON);
    expect(s.learningStyleIdOf).toHaveBeenCalledWith(USER, TOPIC);
  });

  it('only looks up the learning style when the topic is known', async () => {
    const s = sources();

    const ids = await resolveLearningIds({ topicId: TOPIC, learningStyleId: '' }, { lessonId: LESSON, userId: USER }, s);

    expect(ids).toEqual({ topicId: TOPIC, learningStyleId: STYLE });
    expect(s.topicIdOfLesson).not.toHaveBeenCalled();
  });

  it('returns empty ids instead of throwing when nothing can be found', async () => {
    const s = { topicIdOfLesson: vi.fn().mockResolvedValue(null), learningStyleIdOf: vi.fn().mockResolvedValue(undefined) };

    const ids = await resolveLearningIds({ topicId: '', learningStyleId: '' }, { lessonId: LESSON, userId: USER }, s);

    expect(ids).toEqual({ topicId: '', learningStyleId: '' });
    expect(s.learningStyleIdOf).not.toHaveBeenCalled();
  });

  it('skips the learning style lookup for a guest', async () => {
    const s = sources();

    const ids = await resolveLearningIds({ topicId: '', learningStyleId: '' }, { lessonId: LESSON, userId: '' }, s);

    expect(ids).toEqual({ topicId: TOPIC, learningStyleId: '' });
    expect(s.learningStyleIdOf).not.toHaveBeenCalled();
  });
});
