import { z } from 'zod';
import { QueueService } from '../queue.service';
import {
  ContentEmbeddingJobSchema,
  KnowledgeJobSchema,
  UserStepsJobSchema,
  credentialFree,
} from '../queue-payloads';

const makeQueue = () => ({ add: jest.fn().mockResolvedValue({ id: '1' }) });

const userStepsJob = {
  userId: 'u-1',
  topicId: 't-1',
  lessonId: 'l-1',
  learningStyleId: 'ls-1',
  quizId: 'q-1',
};

describe('QueueService', () => {
  let knowledge: ReturnType<typeof makeQueue>;
  let content: ReturnType<typeof makeQueue>;
  let userSteps: ReturnType<typeof makeQueue>;
  let service: QueueService;

  beforeEach(() => {
    knowledge = makeQueue();
    content = makeQueue();
    userSteps = makeQueue();
    service = new QueueService(knowledge as any, content as any, userSteps as any);
  });

  it('queues a knowledge job with identifiers only and bounded retention of failures', async () => {
    await service.addKnowledgeJob({ resourceId: 'r-1', userId: 'u-1' });

    expect(knowledge.add).toHaveBeenCalledWith(
      'embed',
      { resourceId: 'r-1', userId: 'u-1' },
      expect.objectContaining({
        removeOnComplete: true,
        removeOnFail: { age: 604800, count: 500 },
        attempts: 3,
      }),
    );
  });

  it('queues a user steps job with identifiers only', async () => {
    await service.addUserStepsJob(userStepsJob);

    expect(userSteps.add).toHaveBeenCalledWith(
      'generate-user-steps',
      userStepsJob,
      expect.objectContaining({ removeOnFail: { age: 604800, count: 500 }, attempts: 3 }),
    );
  });

  it('keeps the content embedding job and its retention', async () => {
    await service.addContentEmbeddingJob({ contentId: 'c-1', chatId: 'ch-1', textContent: 'isi' });

    expect(content.add).toHaveBeenCalledWith(
      'embed',
      { contentId: 'c-1', chatId: 'ch-1', textContent: 'isi' },
      expect.objectContaining({ removeOnFail: { age: 604800, count: 500 }, attempts: 3 }),
    );
  });

  it.each(['token', 'accessToken', 'authorization', 'cookie'])(
    'refuses a user steps job that carries %s',
    async (key) => {
      await expect(service.addUserStepsJob({ ...userStepsJob, [key]: 'secret-value' } as any)).rejects.toThrow();

      expect(userSteps.add).not.toHaveBeenCalled();
    },
  );

  it('refuses a knowledge job that carries a token', async () => {
    await expect(service.addKnowledgeJob({ resourceId: 'r-1', userId: 'u-1', token: 'jwt' } as any)).rejects.toThrow();

    expect(knowledge.add).not.toHaveBeenCalled();
  });

  it('refuses a job with a missing identifier', async () => {
    await expect(service.addUserStepsJob({ ...userStepsJob, lessonId: undefined } as any)).rejects.toThrow();
    await expect(service.addKnowledgeJob({ resourceId: 'r-1' } as any)).rejects.toThrow();
  });
});

describe('job payload schemas', () => {
  it.each([
    ['UserStepsJobSchema', UserStepsJobSchema],
    ['KnowledgeJobSchema', KnowledgeJobSchema],
    ['ContentEmbeddingJobSchema', ContentEmbeddingJobSchema],
  ])('%s has no field that looks like a credential', (_name, schema) => {
    expect(Object.keys(schema.shape).filter((key) => /token|authorization|secret|password|cookie/i.test(key))).toEqual([]);
  });

  it('credentialFree rejects a schema that gains a credential-like field', () => {
    expect(() => credentialFree(z.object({ userId: z.string(), accessToken: z.string() }))).toThrow(/accessToken/);
    expect(() => credentialFree(z.object({ userId: z.string() }))).not.toThrow();
  });
});
