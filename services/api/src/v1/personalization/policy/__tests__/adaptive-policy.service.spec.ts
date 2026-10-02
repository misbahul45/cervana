import { AdaptivePolicyService } from '../adaptive-policy.service';

describe('AdaptivePolicyService.decideNext (deterministic)', () => {
  let service: AdaptivePolicyService;
  let masteryRepo: { listByUser: jest.Mock };
  let misconceptionRepo: { listActiveByUser: jest.Mock };
  let policyRepo: { upsert: jest.Mock };

  const goldenGraph = {
    levels: [
      {
        id: 1,
        title: 'L1',
        topics: [
          { id: 'l1-t01', title: 'Eq', prerequisites: [] },
          { id: 'l1-t02', title: 'Journals', prerequisites: ['l1-t01'] },
        ],
      },
      {
        id: 2,
        title: 'L2',
        topics: [{ id: 'l2-t01', title: 'Adjusting', prerequisites: ['l1-t02'] }],
      },
    ],
  };

  beforeEach(() => {
    masteryRepo = { listByUser: jest.fn().mockResolvedValue([]) };
    misconceptionRepo = { listActiveByUser: jest.fn().mockResolvedValue([]) };
    policyRepo = { upsert: jest.fn().mockResolvedValue({ id: 'p1' }) };
    service = new AdaptivePolicyService(
      masteryRepo as any,
      misconceptionRepo as any,
      policyRepo as any,
      goldenGraph,
    );
  });

  it('recommends starting topic l1-t01 when user has no mastery', async () => {
    const decision = await service.decideNext('u1');
    expect(decision).toMatchObject({ topicId: 'l1-t01', level: 1, rationaleKind: 'no_exploration' });
  });

  it('recommends remediation on misconception when mastery below threshold', async () => {
    masteryRepo.listByUser.mockResolvedValue([{ topicId: 'l1-t02', score: 0.3 }]);
    misconceptionRepo.listActiveByUser.mockResolvedValue([
      { topicId: 'l1-t02', conceptKey: 'debit_credit_swap' },
    ]);
    const decision = await service.decideNext('u1');
    expect(decision.topicId).toBe('l1-t02');
    expect(decision.rationaleKind).toBe('remediation');
  });

  it('recommends next topic when mastery above threshold and no misconception', async () => {
    masteryRepo.listByUser.mockResolvedValue([{ topicId: 'l1-t01', score: 0.9 }]);
    const decision = await service.decideNext('u1');
    expect(decision.topicId).toBe('l1-t02');
    expect(decision.rationaleKind).toBe('progression');
  });

  it('does not recommend a topic whose prerequisites are unmet', async () => {
    masteryRepo.listByUser.mockResolvedValue([
      { topicId: 'l1-t01', score: 0.9 },
      { topicId: 'l1-t02', score: 0.9 },
    ]);
    const decision = await service.decideNext('u1');
    expect(decision.topicId).toBe('l2-t01');
    expect(decision.rationaleKind).toBe('progression');
  });
});