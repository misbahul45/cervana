import { SimulatorService, periodBounds } from '../simulator.service';
import { SimulatorEngineService } from '../simulator-engine.service';

describe('SimulatorService.createCompany', () => {
  it('creates a 30-day company', async () => {
    const prisma = {
      virtualCompany: {
        create: jest.fn().mockImplementation(async (input: any) => ({
          id: 'co1',
          scenarioSlug: input.data.scenarioSlug,
          startDate: input.data.startDate,
          endDate: input.data.endDate,
        })),
      },
    };
    const service = new SimulatorService(prisma as any);
    const out = await service.createCompany({ ownerId: 'u1', tenantId: 't1', scenarioSlug: 'starter-30d' });
    expect(out.id).toBe('co1');
    expect(out.scenarioSlug).toBe('starter-30d');
  });

  it('lists scenarios with days metadata', () => {
    const prisma = {} as any;
    const service = new SimulatorService(prisma);
    const scenarios = service.listScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(3);
    expect(scenarios[0].days).toBeGreaterThan(0);
  });

  it('computes correct period bounds', () => {
    const { start, end } = periodBounds('2026-03');
    expect(start.getUTCMonth()).toBe(2);
    expect(end.getUTCMonth()).toBe(2);
    expect(end.getUTCDate()).toBe(31);
  });
});

describe('SimulatorEngineService', () => {
  it('closes a period and produces consistent ledgers', async () => {
    const engine = new SimulatorEngineService();
    const repo = {
      entriesForCompany: async () => [
        { id: 'e1', amount: 100, debitAccount: 'Cash', creditAccount: 'ServiceRevenue' },
        { id: 'e2', amount: 50, debitAccount: 'Cash', creditAccount: 'AP' },
      ],
      upsertLedger: jest.fn(),
    };
    const result = await engine.closePeriod({ companyId: 'c1', period: '2026-01', ledgerRepo: repo as any });
    expect(result.accountCount).toBe(3);
    expect(repo.upsertLedger).toHaveBeenCalledTimes(3);
  });

  it('hashes entries deterministically', () => {
    const engine = new SimulatorEngineService();
    const a = engine.hashEntries([
      { id: 'e1', amount: 100, debitAccount: 'Cash', creditAccount: 'Sales' },
      { id: 'e2', amount: 50, debitAccount: 'Cash', creditAccount: 'AP' },
    ]);
    const b = engine.hashEntries([
      { id: 'e2', amount: 50, debitAccount: 'Cash', creditAccount: 'AP' },
      { id: 'e1', amount: 100, debitAccount: 'Cash', creditAccount: 'Sales' },
    ]);
    expect(a).toBe(b);
  });
});