import { SnapshotService } from '../snapshot.service';

describe('SnapshotService (deterministic)', () => {
  it('runAll aggregates the three sub-snapshots', async () => {
    const prisma = {
      topicMasteryRecord: { findMany: jest.fn().mockResolvedValue([{ userId: 'u1', topicId: 't1', score: 0.8, evidenceCount: 3 }]) },
      masterySnapshot: { create: jest.fn() },
      eventLog: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'u1' },
          { userId: 'u2' },
        ]),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]) },
      engagementMetric: { create: jest.fn() },
      teacherApplication: { findMany: jest.fn().mockResolvedValue([{ userId: 'u1' }]) },
      order: { count: jest.fn().mockResolvedValue(5) },
      creatorOutcomeMetric: { create: jest.fn() },
    };
    const svc = new SnapshotService(prisma as any);
    const result = await svc.runAll();
    expect(result.mastery).toBe(1);
    expect(result.engagement).toBe(3);
    expect(result.creator).toBe(1);
  });
});