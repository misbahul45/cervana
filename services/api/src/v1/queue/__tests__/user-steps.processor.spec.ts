import { UnrecoverableError } from 'bullmq';
import { UserStepsProcessor } from '../queues/user-steps.processor';
import { AiServiceError } from '@/common/ai-client/ai-service.error';
import { deriveIdempotencyKey } from '@/common/ai-client/ai-service.client';

const JOB_DATA = { userId: 'u-1', topicId: 't-1', lessonId: 'l-1', learningStyleId: 'ls-1', quizId: 'q-1' };
const STEPS = [
  { id: 's-1', sortOrder: 1 },
  { id: 's-2', sortOrder: 2 },
];

const makeJob = (data: Record<string, unknown> = JOB_DATA, id = '42') => ({ id, queueName: 'user-steps', data }) as any;

const userStepRow = (stepId: string, index = 0) => ({
  id: `us-${stepId}-${index}`,
  chat: { id: `chat-${stepId}-${index}`, messages: [{ id: `msg-${stepId}-${index}` }] },
});

describe('UserStepsProcessor', () => {
  let ai: { post: jest.Mock };
  let stepsRepo: { findAll: jest.Mock };
  let userStepsRepo: { create: jest.Mock };
  let sse: { emitUpdate: jest.Mock };
  let processor: UserStepsProcessor;

  const pathsCalled = () => ai.post.mock.calls.map(([request]) => request.path);

  beforeEach(() => {
    ai = { post: jest.fn() };
    ai.post.mockImplementation(async ({ path }) => (path === '/users-steps/generate' ? [{ userId: 'u-1', title: 'Mulai', stepTemplateId: 's' }] : { task_id: 't', status: 'processing' }));
    stepsRepo = { findAll: jest.fn().mockResolvedValue({ data: STEPS }) };
    userStepsRepo = {
      create: jest.fn(async (rows: any[]) => rows.map((row, index) => userStepRow(String(row.order), index))),
    };
    sse = { emitUpdate: jest.fn() };
    processor = new UserStepsProcessor(ai as any, stepsRepo as any, userStepsRepo as any, sse as any);
    (processor as any).retryDelayMs = 0;
  });

  it('generates the user steps of every lesson step as the acting user and then the material of each', async () => {
    const result = await processor.process(makeJob());

    expect(pathsCalled()).toEqual([
      '/users-steps/generate',
      '/learning/generate-material',
      '/users-steps/generate',
      '/learning/generate-material',
    ]);
    expect(ai.post.mock.calls[0][0]).toMatchObject({
      actingUserId: 'u-1',
      body: { topicId: 't-1', lessonId: 'l-1', learningStyleId: 'ls-1', targetStepId: 's-1' },
    });
    expect(ai.post.mock.calls[1][0]).toMatchObject({
      actingUserId: 'u-1',
      body: { stepId: 's-1', userStepId: 'us-10-0', messageId: 'msg-10-0', chatId: 'chat-10-0' },
    });
    expect(sse.emitUpdate).toHaveBeenCalledWith('u-1', 's-1', false);
    expect(sse.emitUpdate).toHaveBeenCalledWith('u-1', 's-2', true);
    expect(result).toMatchObject({ failedSteps: [] });
  });

  it('formats the created rows with the order and the unlock rule', async () => {
    await processor.process(makeJob());

    expect(userStepsRepo.create.mock.calls[0][0]).toEqual([
      expect.objectContaining({ title: 'Mulai', order: 10, isUnlocked: true }),
    ]);
    expect(userStepsRepo.create.mock.calls[1][0]).toEqual([
      expect.objectContaining({ title: 'Mulai', order: 20, isUnlocked: false }),
    ]);
  });

  it('never sends a token, in a header, a body or a key, and ignores one left in an old job', async () => {
    await processor.process(makeJob({ ...JOB_DATA, token: 'eyJ.legacy.jwt' }));

    const sent = JSON.stringify(ai.post.mock.calls);
    expect(sent).not.toContain('eyJ.legacy.jwt');
    expect(sent.toLowerCase()).not.toContain('authorization');
    expect(sent).not.toContain('"token"');
  });

  it('derives the same idempotency keys when the same job runs again and different keys for different calls', async () => {
    await processor.process(makeJob());
    const first = ai.post.mock.calls.map(([request]) => request.idempotencyKey);
    ai.post.mockClear();
    await processor.process(makeJob());
    const second = ai.post.mock.calls.map(([request]) => request.idempotencyKey);

    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
    expect(first[0]).toBe(
      deriveIdempotencyKey([
        'user-steps',
        '42',
        '/users-steps/generate',
        JSON.stringify({ topicId: 't-1', lessonId: 'l-1', learningStyleId: 'ls-1', targetStepId: 's-1' }),
      ]),
    );
  });

  it('uses another set of keys for another job', async () => {
    await processor.process(makeJob(JOB_DATA, '42'));
    const first = ai.post.mock.calls[0][0].idempotencyKey;
    ai.post.mockClear();

    await processor.process(makeJob(JOB_DATA, '43'));

    expect(ai.post.mock.calls[0][0].idempotencyKey).not.toBe(first);
  });

  it('does not retry a refusal and goes on with the other steps', async () => {
    ai.post.mockImplementation(async ({ path, body }) => {
      if (path === '/users-steps/generate' && body.targetStepId === 's-1') throw new AiServiceError('refused', 422, false);
      return path === '/users-steps/generate' ? [{ userId: 'u-1', title: 'Mulai' }] : { task_id: 't' };
    });

    const result = await processor.process(makeJob());

    expect(ai.post.mock.calls.filter(([r]) => r.body?.targetStepId === 's-1')).toHaveLength(1);
    expect(result).toMatchObject({ failedSteps: ['s-1'] });
    expect(sse.emitUpdate).toHaveBeenCalledWith('u-1', 's-2', true);
  });

  it('retries a temporary failure three times and then reports the step as failed', async () => {
    ai.post.mockImplementation(async ({ path, body }) => {
      if (path === '/users-steps/generate' && body.targetStepId === 's-1') throw new AiServiceError('later', 503, true);
      return path === '/users-steps/generate' ? [{ userId: 'u-1', title: 'Mulai' }] : { task_id: 't' };
    });

    const result = await processor.process(makeJob());

    expect(ai.post.mock.calls.filter(([r]) => r.body?.targetStepId === 's-1')).toHaveLength(3);
    expect(result).toMatchObject({ failedSteps: ['s-1'] });
  });

  it('retries only the material call when the material call fails, not the step generation', async () => {
    let materialCalls = 0;
    ai.post.mockImplementation(async ({ path }) => {
      if (path === '/learning/generate-material') {
        materialCalls += 1;
        if (materialCalls === 1) throw new AiServiceError('later', 503, true);
        return { task_id: 't' };
      }
      return [{ userId: 'u-1', title: 'Mulai' }];
    });

    const result = await processor.process(makeJob());

    expect(pathsCalled().filter((path) => path === '/users-steps/generate')).toHaveLength(2);
    expect(userStepsRepo.create).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ failedSteps: [] });
  });

  it('does not ask for material when the user steps could not be stored', async () => {
    userStepsRepo.create.mockRejectedValueOnce(new Error('unique constraint'));

    const result = await processor.process(makeJob());

    expect(result).toMatchObject({ failedSteps: ['s-1'] });
    expect(ai.post.mock.calls.filter(([r]) => r.body?.stepId === 's-1')).toHaveLength(0);
  });

  it('treats an answer that is not a list or an object of user steps as a failure of that step', async () => {
    ai.post.mockImplementation(async ({ path }) => (path === '/users-steps/generate' ? null : { task_id: 't' }));

    await expect(processor.process(makeJob())).rejects.toThrow();
  });

  it('fails the job when every step failed, as unrecoverable when no retry can help', async () => {
    ai.post.mockRejectedValue(new AiServiceError('refused', 422, false));

    await expect(processor.process(makeJob())).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('fails the job with the original error when every step failed for a temporary reason', async () => {
    ai.post.mockRejectedValue(new AiServiceError('later', 503, true));

    const failure = await processor.process(makeJob()).catch((error) => error);

    expect(failure).toBeInstanceOf(AiServiceError);
    expect(failure).not.toBeInstanceOf(UnrecoverableError);
  });

  it('refuses a job without its identifiers', async () => {
    await expect(processor.process(makeJob({ userId: 'u-1' }))).rejects.toThrow();

    expect(ai.post).not.toHaveBeenCalled();
  });
});
