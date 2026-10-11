import { RewardRulesService } from '../reward-rules.service';
import { DEFAULT_RULE_SET } from '../reward-rules';
import { RewardEngineService } from '../reward-engine.service';

const row = (overrides: Record<string, unknown>) => ({
  id: 'r',
  code: 'CONCEPT_PASSED',
  version: 1,
  eventType: 'ASSESSMENT_COMPLETED',
  rewardKind: 'XP',
  amount: 50,
  dailyCap: null,
  params: null,
  active: true,
  createdAt: new Date(),
  ...overrides,
});

describe('RewardRulesService', () => {
  it('reads every rule row, active or not, through the given client and builds the rule set', async () => {
    const tx = { rewardRule: { findMany: jest.fn().mockResolvedValue([row({ version: 2, amount: 80 }), row({ version: 1 })]) } };

    const set = await new RewardRulesService().current(tx as never);

    expect(tx.rewardRule.findMany).toHaveBeenCalledWith();
    expect(set.conceptPassed).toEqual({ version: 2, points: 80 });
  });

  it('gives the defaults when the table has no rows', async () => {
    const tx = { rewardRule: { findMany: jest.fn().mockResolvedValue([]) } };

    expect(await new RewardRulesService().current(tx as never)).toEqual(DEFAULT_RULE_SET);
  });
});

describe('RewardEngineService with rule rows', () => {
  const entry = (points: number) => ({ id: `entry-${points}`, points });
  const build = (rows: unknown[]) => {
    const tx = {
      gamificationLedger: { aggregate: jest.fn().mockResolvedValue({ _sum: { points: 0 } }) },
      rewardRule: { findMany: jest.fn().mockResolvedValue(rows) },
    };
    const ledger = { grant: jest.fn(async (input: { points: number; ruleId: string; ruleVersion: number }) => ({ entry: entry(input.points), duplicate: false })) };
    return { engine: new RewardEngineService(ledger as never, new RewardRulesService()), ledger, tx };
  };
  const event = { userId: 'u1', conceptId: 'c1', eventId: 'e1', duplicate: false, after: { score: 0.8, evidenceCount: 3 } };

  it('pays with the version and values of the stored rules', async () => {
    const { engine, ledger, tx } = build([
      row({ code: 'MASTERY_PROGRESS', version: 2, amount: 40, params: { perUnit: 200, baseline: 0.5 } }),
      row({ code: 'CONCEPT_PASSED', version: 2, amount: 70 }),
    ]);

    const outcome = await engine.onAssessment(event, tx as never);

    expect(ledger.grant.mock.calls.map(([g]) => [g.ruleId, g.ruleVersion, g.points])).toEqual([
      ['MASTERY_PROGRESS', 2, 40],
      ['CONCEPT_PASSED', 2, 70],
    ]);
    expect(outcome.points).toBe(110);
  });

  it('pays nothing for a rule whose rows are all off', async () => {
    const { engine, ledger, tx } = build([
      row({ code: 'MASTERY_PROGRESS', version: 1, active: false }),
      row({ code: 'CONCEPT_PASSED', version: 1, active: false }),
    ]);

    const outcome = await engine.onAssessment(event, tx as never);

    expect(ledger.grant).not.toHaveBeenCalled();
    expect(outcome).toEqual({ points: 0, entryIds: [] });
  });

  it('still works without a rules service, with the default rules', async () => {
    const tx = { gamificationLedger: { aggregate: jest.fn().mockResolvedValue({ _sum: { points: 0 } }) } };
    const ledger = { grant: jest.fn(async (input: { points: number }) => ({ entry: entry(input.points), duplicate: false })) };

    await new RewardEngineService(ledger as never).onAssessment(event, tx as never);

    expect(ledger.grant).toHaveBeenCalledTimes(2);
  });
});
