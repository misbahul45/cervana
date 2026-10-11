import { RewardEngineService } from '../reward-engine.service';

const entry = (points: number) => ({ id: `entry-${points}`, points });

interface GrantCall {
  points: number;
  ruleId: string;
  topicId?: string;
  subTopicId?: string;
}

const build = (paid = 0) => {
  const tx = { gamificationLedger: { aggregate: jest.fn().mockResolvedValue({ _sum: { points: paid } }) } };
  const ledger = { grant: jest.fn(async (input: GrantCall) => ({ entry: entry(input.points), duplicate: false })) };
  const engine = new RewardEngineService(ledger as never);
  return { engine, ledger, tx };
};

const input = (overrides: Record<string, unknown> = {}) => ({
  userId: 'u1',
  conceptId: 'c1',
  eventId: 'evt-1',
  duplicate: false,
  after: { score: 0.622, evidenceCount: 1 },
  topicId: 'topic-1',
  subTopicId: 'sub-1',
  ...overrides,
});

describe('RewardEngineService.onAssessment', () => {
  it('grants the progress of the new score through the ledger, in the callers transaction, with the quiz location', async () => {
    const { engine, ledger, tx } = build(0);

    const outcome = await engine.onAssessment(input(), tx as never);

    expect(ledger.grant).toHaveBeenCalledTimes(1);
    expect(ledger.grant).toHaveBeenCalledWith(
      {
        userId: 'u1',
        ruleId: 'MASTERY_PROGRESS',
        ruleVersion: 1,
        points: 12,
        idempotencyKey: 'reward:MASTERY_PROGRESS:v1:evt-1',
        sourceType: 'LEARNING_EVENT',
        sourceId: 'evt-1',
        conceptId: 'c1',
        topicId: 'topic-1',
        subTopicId: 'sub-1',
      },
      tx,
    );
    expect(outcome).toEqual({ points: 12, entryIds: ['entry-12'] });
  });

  it('counts what was already paid for this learner and concept, without reversals, so a reversed grant is not paid again', async () => {
    const { engine, ledger, tx } = build(12);

    await engine.onAssessment(input({ after: { score: 0.7026, evidenceCount: 2 } }), tx as never);

    expect(tx.gamificationLedger.aggregate).toHaveBeenCalledWith({
      where: { userId: 'u1', conceptId: 'c1', ruleId: 'MASTERY_PROGRESS', reversalOf: null },
      _sum: { points: true },
    });
    expect(ledger.grant.mock.calls[0][0].points).toBe(8);
  });

  it('grants the pass reward together with the progress when the concept is passed', async () => {
    const { engine, ledger, tx } = build(20);

    const outcome = await engine.onAssessment(input({ after: { score: 0.7558, evidenceCount: 3 } }), tx as never);

    expect(ledger.grant.mock.calls.map(([g]) => [g.ruleId, g.points])).toEqual([
      ['MASTERY_PROGRESS', 5],
      ['CONCEPT_PASSED', 50],
    ]);
    expect(outcome.points).toBe(55);
  });

  it('counts only the grants the ledger actually stored', async () => {
    const { engine, ledger, tx } = build(20);
    ledger.grant.mockImplementation(async (g: GrantCall) => ({ entry: entry(g.points), duplicate: g.ruleId === 'CONCEPT_PASSED' }));

    const outcome = await engine.onAssessment(input({ after: { score: 0.7558, evidenceCount: 3 } }), tx as never);

    expect(outcome).toEqual({ points: 5, entryIds: ['entry-5'] });
  });

  it('pays nothing for an event the stream already held, and does not even read the ledger', async () => {
    const { engine, ledger, tx } = build(0);

    const outcome = await engine.onAssessment(input({ duplicate: true }), tx as never);

    expect(outcome).toEqual({ points: 0, entryIds: [] });
    expect(ledger.grant).not.toHaveBeenCalled();
    expect(tx.gamificationLedger.aggregate).not.toHaveBeenCalled();
  });

  it('pays nothing when the score is not above even odds', async () => {
    const { engine, ledger, tx } = build(0);

    const outcome = await engine.onAssessment(input({ after: { score: 0.45, evidenceCount: 1 } }), tx as never);

    expect(outcome.points).toBe(0);
    expect(ledger.grant).not.toHaveBeenCalled();
  });

  it('leaves out the location it does not know', async () => {
    const { engine, ledger, tx } = build(0);

    await engine.onAssessment(input({ topicId: undefined, subTopicId: undefined }), tx as never);

    const granted = ledger.grant.mock.calls[0][0];
    expect(granted.topicId).toBeUndefined();
    expect(granted.subTopicId).toBeUndefined();
  });

  it('lets a ledger failure through, so the caller can roll its transaction back', async () => {
    const { engine, ledger, tx } = build(0);
    ledger.grant.mockRejectedValueOnce(new Error('ledger down'));

    await expect(engine.onAssessment(input(), tx as never)).rejects.toThrow('ledger down');
  });
});
