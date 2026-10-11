import { ResourcesRepo } from '../resources.repo';

describe('ResourcesRepo.create job', () => {
  it('queues the knowledge job with the resource and the creating user, without any token', async () => {
    const prisma = { resource: { create: jest.fn().mockResolvedValue({ id: 'r-1' }) } };
    const queue = { addKnowledgeJob: jest.fn().mockResolvedValue(undefined) };
    const repo = new ResourcesRepo(prisma as any, queue as any);

    await repo.create({ type: 'TEXT', title: 'Catatan', content: 'isi' } as any, 'teacher-1');

    expect(queue.addKnowledgeJob).toHaveBeenCalledWith({ resourceId: 'r-1', userId: 'teacher-1' });
  });
});
