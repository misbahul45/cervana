import { MemoryService } from '../memory.service';

describe('MemoryService (Phase 2)', () => {
  let service: MemoryService;
  let repo: {
    create: jest.Mock;
    listByLesson: jest.Mock;
    listAllByUser: jest.Mock;
    trimForLesson: jest.Mock;
  };

  beforeEach(() => {
    repo = {
      create: jest.fn().mockImplementation(async (input: any) => ({ id: 'mem1', ...input })),
      listByLesson: jest.fn().mockResolvedValue([]),
      listAllByUser: jest.fn().mockResolvedValue([]),
      trimForLesson: jest.fn().mockResolvedValue(0),
    };
    service = new MemoryService(repo as any, 90, 20);
  });

  it('records a short-term item with expiresAt 90 days out', async () => {
    const before = Date.now();
    await service.record({
      userId: 'u1',
      lessonId: 'l1',
      kind: 'SHORT_TERM',
      payload: { note: 'hi' },
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        eventType: 'SHORT_TERM',
        content: JSON.stringify({ note: 'hi' }),
        expiresAt: expect.any(Date),
      }),
    );
    const call = repo.create.mock.calls[0][0];
    expect(call.expiresAt.getTime() - before).toBeGreaterThan(89 * 86_400_000);
  });

  it('trims to last 20 short-term items per (user, lesson)', async () => {
    repo.listByLesson.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => ({
        id: `m${i}`,
        userId: 'u1',
        lessonId: 'l1',
        eventType: 'SHORT_TERM',
      })),
    );
    await service.record({
      userId: 'u1',
      lessonId: 'l1',
      kind: 'SHORT_TERM',
      payload: { newest: true },
    });
    expect(repo.trimForLesson).toHaveBeenCalledWith('u1', 'l1', 20);
  });

  it('lists lesson-scoped memory with no cross-lesson leakage by default', async () => {
    repo.listByLesson.mockResolvedValue([
      { id: 'm1', userId: 'u1', lessonId: 'l1', eventType: 'SHORT_TERM' },
      { id: 'm2', userId: 'u1', lessonId: 'l2', eventType: 'SHORT_TERM' },
    ]);
    const out = await service.listForLesson({ userId: 'u1', lessonId: 'l1', kind: 'SHORT_TERM' });
    expect(out.every((m: any) => m.lessonId === 'l1')).toBe(true);
  });

  it('returns long-term profile when no lessonId is given', async () => {
    repo.listAllByUser.mockResolvedValue([
      { id: 'p1', userId: 'u1', eventType: 'LONG_TERM_PROFILE' },
    ]);
    const out = await service.listLongTermProfile('u1');
    expect(out).toHaveLength(1);
  });
});