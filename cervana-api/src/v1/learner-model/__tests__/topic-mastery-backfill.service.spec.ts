import { Test } from '@nestjs/testing';
import { TopicMasteryBackfillService } from '../topic-mastery-backfill.service';

describe('TopicMasteryBackfillService', () => {
  let service: TopicMasteryBackfillService;
  let prisma: { $queryRaw: jest.Mock; topicMasteryRecord: { upsert: jest.Mock } };

  const fakeRows = [
    { userId: 'u-1', topicId: 't-1', progress: 50, updatedAt: new Date('2026-01-01') },
    { userId: 'u-1', topicId: 't-2', progress: 80, updatedAt: new Date('2026-01-02') },
    { userId: 'u-2', topicId: 't-1', progress: 0, updatedAt: new Date('2026-01-03') },
    { userId: 'u-3', topicId: 't-1', progress: 100, updatedAt: new Date('2026-01-04') },
    { userId: 'u-4', topicId: 't-1', progress: 120, updatedAt: new Date('2026-01-05') },
  ];

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue(fakeRows),
      topicMasteryRecord: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TopicMasteryBackfillService,
        { provide: 'PrismaService', useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(TopicMasteryBackfillService);
  });

  it('runs the aggregation SQL', async () => {
    await service.runBackfill();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('converts progress percentage to 0..1 score', async () => {
    await service.runBackfill();
    const calls = prisma.topicMasteryRecord.upsert.mock.calls;
    const scores = calls.map((c) => c[0].create.score);
    expect(scores).toEqual([0.5, 0.8, 0.0, 1.0, 1.0]);
  });

  it('uses low confidence (0.3) for backfilled data', async () => {
    await service.runBackfill();
    for (const c of prisma.topicMasteryRecord.upsert.mock.calls) {
      expect(c[0].create.confidence).toBe(0.3);
    }
  });

  it('sets evidenceCount to 1 for backfilled rows', async () => {
    await service.runBackfill();
    for (const c of prisma.topicMasteryRecord.upsert.mock.calls) {
      expect(c[0].create.evidenceCount).toBe(1);
    }
  });

  it('sets lastObservedAt from the aggregation result', async () => {
    await service.runBackfill();
    const first = prisma.topicMasteryRecord.upsert.mock.calls[0];
    expect(first[0].create.lastObservedAt).toEqual(fakeRows[0].updatedAt);
  });

  it('uses the correct composite key', async () => {
    await service.runBackfill();
    for (const c of prisma.topicMasteryRecord.upsert.mock.calls) {
      expect(c[0].where.userId_topicId).toEqual({
        userId: c[0].create.userId,
        topicId: c[0].create.topicId,
      });
    }
  });

  it('counts inserted vs skipped rows', async () => {
    prisma.topicMasteryRecord.upsert
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('duplicate'))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const result = await service.runBackfill();
    expect(result.inserted).toBe(3);
    expect(result.skipped).toBe(1);
  });

  it('logs and continues when upsert fails', async () => {
    const loggerSpy = jest.spyOn(
      TopicMasteryBackfillService.prototype['logger'],
      'warn',
    );
    prisma.topicMasteryRecord.upsert.mockRejectedValue(new Error('boom'));

    const result = await service.runBackfill();
    expect(result.skipped).toBe(fakeRows.length);
    expect(loggerSpy).toHaveBeenCalled();
  });

  it('returns zero counts when no rows are returned', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const result = await service.runBackfill();
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(prisma.topicMasteryRecord.upsert).not.toHaveBeenCalled();
  });
});