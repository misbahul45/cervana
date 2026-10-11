import { SnapshotService } from '../snapshot.service';

describe('SnapshotService (deterministic)', () => {
  it('runAll aggregates the three sub-snapshots', async () => {
    const prisma = {
      conceptMastery: { findMany: jest.fn().mockResolvedValue([{ userId: 'u1', conceptId: 'c1', score: 0.8, evidenceCount: 3 }]) },
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

  it('snapshots the concept mastery of every learner and never the legacy topic record', async () => {
    const prisma = {
      conceptMastery: { findMany: jest.fn().mockResolvedValue([{ userId: 'u1', conceptId: 'c1', score: 0.8, evidenceCount: 3 }, { userId: 'u2', conceptId: 'c2', score: 0.5, evidenceCount: 0 }]) },
      masterySnapshot: { create: jest.fn() },
    };

    const count = await new SnapshotService(prisma as any).snapshotMastery();

    expect(prisma.conceptMastery.findMany).toHaveBeenCalledWith({ where: { evidenceCount: { gt: 0 }, concept: { status: 'ACTIVE' } } });
    expect(prisma.masterySnapshot.create).toHaveBeenCalledTimes(2);
    expect(prisma.masterySnapshot.create).toHaveBeenCalledWith({
      data: { userId: 'u1', conceptId: 'c1', score: 0.8, attempts: 3, snapshotAt: expect.any(Date) },
    });
    expect(count).toBe(2);
  });
});