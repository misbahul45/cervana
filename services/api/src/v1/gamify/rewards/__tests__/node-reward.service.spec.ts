import { NodeRewardService } from '../node-reward.service';

const passed = (conceptId: string) => ({ conceptId, score: 0.8, evidenceCount: 3 });

const build = (options: { ids?: string[]; rows?: Array<{ conceptId: string; score: number; evidenceCount: number }>; duplicate?: boolean; ruleRows?: unknown[] } = {}) => {
  const tx = {
    conceptMastery: { findMany: jest.fn().mockResolvedValue(options.rows ?? []) },
    rewardRule: { findMany: jest.fn().mockResolvedValue(options.ruleRows ?? []) },
  };
  const registry = { subTopicConceptIds: jest.fn().mockResolvedValue(options.ids ?? []) };
  const ledger = { grant: jest.fn(async (input: { points: number }) => ({ entry: { id: 'star-1', points: input.points }, duplicate: options.duplicate ?? false })) };
  const service = new NodeRewardService(registry as never, ledger as never, { current: async () => (await import('../reward-rules')).buildRuleSet(((options.ruleRows ?? []) as never[])) } as never);
  return { service, tx, registry, ledger };
};

describe('NodeRewardService', () => {
  it('pays one star when every concept of the node is passed', async () => {
    const { service, tx, ledger } = build({ ids: ['a', 'b'], rows: [passed('a'), passed('b')] });

    const result = await service.onAssessment({ userId: 'u1', subTopicId: 'sub-1' }, tx as never);

    expect(result).toEqual({ stars: 1 });
    expect(ledger.grant).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', kind: 'STAR', ruleId: 'PATH_NODE_MASTERED', points: 1, idempotencyKey: 'reward:PATH_NODE_MASTERED:v1:u1:sub-1', subTopicId: 'sub-1' }),
      tx,
    );
    expect(tx.conceptMastery.findMany).toHaveBeenCalledWith({ where: { userId: 'u1', conceptId: { in: ['a', 'b'] } } });
  });

  it('pays nothing while one concept is below the pass score or has too little evidence or no row at all', async () => {
    for (const rows of [
      [passed('a'), { conceptId: 'b', score: 0.69, evidenceCount: 9 }],
      [passed('a'), { conceptId: 'b', score: 0.95, evidenceCount: 2 }],
      [passed('a')],
      [],
    ]) {
      const { service, tx, ledger } = build({ ids: ['a', 'b'], rows });

      expect(await service.onAssessment({ userId: 'u1', subTopicId: 'sub-1' }, tx as never)).toEqual({ stars: 0 });
      expect(ledger.grant).not.toHaveBeenCalled();
    }
  });

  it('pays nothing for a node without approved concepts or without a sub-topic', async () => {
    const empty = build({ ids: [] });
    expect(await empty.service.onAssessment({ userId: 'u1', subTopicId: 'sub-1' }, empty.tx as never)).toEqual({ stars: 0 });
    expect(empty.ledger.grant).not.toHaveBeenCalled();

    const none = build({ ids: ['a'], rows: [passed('a')] });
    expect(await none.service.onAssessment({ userId: 'u1', subTopicId: null }, none.tx as never)).toEqual({ stars: 0 });
    expect(none.registry.subTopicConceptIds).not.toHaveBeenCalled();
  });

  it('counts no star for a repeat of the same node', async () => {
    const { service, tx } = build({ ids: ['a'], rows: [passed('a')], duplicate: true });

    expect(await service.onAssessment({ userId: 'u1', subTopicId: 'sub-1' }, tx as never)).toEqual({ stars: 0 });
  });

  it('follows the stored rule: its amount and version, and nothing when it is off', async () => {
    const rule = (overrides: Record<string, unknown>) => ({ code: 'PATH_NODE_MASTERED', version: 2, eventType: 'NODE_MASTERED', rewardKind: 'STAR', amount: 2, dailyCap: null, params: null, active: true, ...overrides });
    const tuned = build({ ids: ['a'], rows: [passed('a')], ruleRows: [rule({})] });
    expect(await tuned.service.onAssessment({ userId: 'u1', subTopicId: 'sub-1' }, tuned.tx as never)).toEqual({ stars: 2 });
    expect(tuned.ledger.grant).toHaveBeenCalledWith(expect.objectContaining({ ruleVersion: 2, points: 2, idempotencyKey: 'reward:PATH_NODE_MASTERED:v2:u1:sub-1' }), tuned.tx);

    const off = build({ ids: ['a'], rows: [passed('a')], ruleRows: [rule({ active: false })] });
    expect(await off.service.onAssessment({ userId: 'u1', subTopicId: 'sub-1' }, off.tx as never)).toEqual({ stars: 0 });
    expect(off.registry.subTopicConceptIds).not.toHaveBeenCalled();
  });
});
