import { SimulatorEngineService } from '../simulator-engine.service';

describe('Simulator snapshot balance (Phase 6)', () => {
  it('balance sheet equals assets = liabilities + equity on every snapshot', async () => {
    const engine = new SimulatorEngineService();
    const ledgers = [
      { accountName: 'Cash', balance: 1000 },
      { accountName: 'Inventory', balance: 500 },
      { accountName: 'AP', balance: -300 },
      { accountName: 'OwnerEquity', balance: -1200 },
    ];
    const statements = await engine.generateStatements({
      companyId: 'x',
      period: '2026-01',
      ledgerRepo: { listLedgers: async () => ledgers as any } as any,
    });
    expect(statements.balanceSheet.assets).toBe(statements.balanceSheet.liabilities + statements.balanceSheet.equity);
    expect(statements.balanceSheet.balanced).toBe(true);
  });

  it('handles empty ledger set with zero balance', async () => {
    const engine = new SimulatorEngineService();
    const statements = await engine.generateStatements({
      companyId: 'x',
      period: '2026-01',
      ledgerRepo: { listLedgers: async () => [] as any } as any,
    });
    expect(statements.balanceSheet.assets).toBe(0);
    expect(statements.balanceSheet.balanced).toBe(true);
  });

  it('snapshotHash is stable across calls with the same ledgers', async () => {
    const engine = new SimulatorEngineService();
    const ledgers = [
      { accountName: 'Cash', balance: 1000 },
      { accountName: 'AP', balance: -500 },
      { accountName: 'OwnerEquity', balance: -500 },
    ];
    const a = await engine.generateStatements({
      companyId: 'x',
      period: '2026-01',
      ledgerRepo: { listLedgers: async () => ledgers as any } as any,
    });
    const b = await engine.generateStatements({
      companyId: 'x',
      period: '2026-01',
      ledgerRepo: { listLedgers: async () => ledgers as any } as any,
    });
    expect(a.snapshotHash).toBe(b.snapshotHash);
  });
});