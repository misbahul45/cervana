import { DecisionTraceService } from '../decision-trace.service';

describe('DecisionTraceService.record', () => {
  let service: DecisionTraceService;

  beforeEach(() => {
    const prisma = {
      decisionTrace: { create: jest.fn().mockResolvedValue({}) },
    };
    service = new DecisionTraceService(prisma as any);
  });

  it('persists a decision trace with ttlAt = createdAt + 90 days', () => {
    const before = Date.now();
    service.record({
      agentName: 'tutor',
      agentScope: 'TUTOR',
      userId: 'u1',
      promptHash: 'p1',
      responseHash: 'r1',
      toolCalls: [],
      deterministicOutputs: {},
    });
    expect((service as any).prisma.decisionTrace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ttlAt: expect.any(Date) }),
      }),
    );
    const data = ((service as any).prisma.decisionTrace.create.mock.calls[0][0] as { data: { ttlAt: Date } }).data;
    expect(data.ttlAt.getTime() - before).toBeGreaterThan(89 * 86_400_000);
  });

  it('includes ownership checkouts when provided', async () => {
    const prisma = {
      decisionTrace: { create: jest.fn().mockImplementation(async (args: any) => args) },
    };
    const svc = new DecisionTraceService(prisma as any);
    const out = await svc.record({
      agentName: 'tutor',
      agentScope: 'TUTOR',
      userId: 'u1',
      promptHash: 'p',
      responseHash: 'r',
      toolCalls: [],
      deterministicOutputs: {},
      ownershipCheckouts: [{ endpoint: '/v1/admin/moderation', result: 'deny' }],
    });
    expect((out as any).data.ownershipCheckouts[0].result).toBe('deny');
  });
});