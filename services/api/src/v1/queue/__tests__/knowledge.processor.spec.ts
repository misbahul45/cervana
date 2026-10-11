import { UnrecoverableError } from 'bullmq';
import { JOBSTATUSTYPE, ResourceType } from '@prisma/client';
import { KnowledgeProcessor } from '../queues/knowledge.processor';
import { AiServiceError } from '@/common/ai-client/ai-service.error';
import { deriveIdempotencyKey } from '@/common/ai-client/ai-service.client';

const makeJob = (data: Record<string, unknown> = { resourceId: 'r-1', userId: 'teacher-1' }) =>
  ({ id: '7', queueName: 'knowledge', data }) as any;

describe('KnowledgeProcessor', () => {
  let ai: { post: jest.Mock };
  let resourcesRepo: { update: jest.Mock };
  let processor: KnowledgeProcessor;

  beforeEach(() => {
    ai = { post: jest.fn().mockResolvedValue({ task_id: 't', status: 'queued' }) };
    resourcesRepo = { update: jest.fn().mockResolvedValue({ id: 'r-1', type: ResourceType.TEXT }) };
    processor = new KnowledgeProcessor(ai as any, resourcesRepo as any);
  });

  it('marks the resource as processing and asks for the embedding of a text resource as the creating user', async () => {
    const result = await processor.process(makeJob());

    expect(resourcesRepo.update).toHaveBeenCalledWith('r-1', { isEmbedded: false, jobStatus: JOBSTATUSTYPE.PROCESSING });
    expect(ai.post).toHaveBeenCalledTimes(1);
    expect(ai.post.mock.calls[0][0]).toMatchObject({
      path: '/resources/embedding/r-1',
      actingUserId: 'teacher-1',
      idempotencyKey: deriveIdempotencyKey(['knowledge', '7', '/resources/embedding/r-1', '']),
    });
    expect(result).toEqual({ message: 'Embedding triggered directly for TEXT' });
  });

  it.each([ResourceType.PDF, ResourceType.IMAGE, ResourceType.VIDEO])('asks for the extraction of a %s resource', async (type) => {
    resourcesRepo.update.mockResolvedValue({ id: 'r-1', type });

    await processor.process(makeJob());

    expect(ai.post.mock.calls[0][0]).toMatchObject({
      path: '/resources/extract',
      query: { type, resource_id: 'r-1' },
      actingUserId: 'teacher-1',
    });
  });

  it('never sends a token and ignores one left in an old job', async () => {
    await processor.process(makeJob({ resourceId: 'r-1', userId: 'teacher-1', token: 'eyJ.legacy.jwt' }));

    const sent = JSON.stringify(ai.post.mock.calls);
    expect(sent).not.toContain('eyJ.legacy.jwt');
    expect(sent.toLowerCase()).not.toContain('authorization');
  });

  it('derives the same idempotency key on every attempt of a job', async () => {
    await processor.process(makeJob());
    await processor.process(makeJob());

    expect(ai.post.mock.calls[1][0].idempotencyKey).toBe(ai.post.mock.calls[0][0].idempotencyKey);
  });

  it('marks the resource as failed and rethrows a temporary failure so the job is retried', async () => {
    const failure = new AiServiceError('later', 503, true);
    ai.post.mockRejectedValue(failure);

    await expect(processor.process(makeJob())).rejects.toBe(failure);

    expect(resourcesRepo.update).toHaveBeenLastCalledWith('r-1', { jobStatus: JOBSTATUSTYPE.FAILED });
  });

  it('ends the job as unrecoverable when the AI service refuses the request', async () => {
    ai.post.mockRejectedValue(new AiServiceError('refused', 401, false));

    await expect(processor.process(makeJob())).rejects.toBeInstanceOf(UnrecoverableError);
    expect(resourcesRepo.update).toHaveBeenLastCalledWith('r-1', { jobStatus: JOBSTATUSTYPE.FAILED });
  });

  it('fails when the resource does not exist', async () => {
    resourcesRepo.update.mockResolvedValue(null);

    await expect(processor.process(makeJob())).rejects.toThrow('not found');
    expect(ai.post).not.toHaveBeenCalled();
  });

  it('refuses a job without a creating user', async () => {
    await expect(processor.process(makeJob({ resourceId: 'r-1' }))).rejects.toThrow();

    expect(resourcesRepo.update).not.toHaveBeenCalled();
  });
});
