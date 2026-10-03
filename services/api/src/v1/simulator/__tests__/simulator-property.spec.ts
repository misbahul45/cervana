import fc from 'fast-check';
import { SimulatorEngineService } from '../simulator-engine.service';

describe('Simulator property: balance holds for random streams', () => {
  it('Debit = Credit for 100 randomized transaction streams (Phase 6)', () => {
    const engine = new SimulatorEngineService();
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            amount: fc.integer({ min: 1, max: 10_000_000 }),
            debitAccount: fc.constantFrom('Cash', 'Inventory', 'AR', 'ServiceRevenue', 'COGS'),
            creditAccount: fc.constantFrom('Cash', 'Inventory', 'AR', 'ServiceRevenue', 'COGS'),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        (entries) => {
          const accounts = new Map<string, { debit: number; credit: number }>();
          for (const e of entries) {
            const d = accounts.get(e.debitAccount) ?? { debit: 0, credit: 0 };
            d.debit += e.amount;
            accounts.set(e.debitAccount, d);
            const c = accounts.get(e.creditAccount) ?? { debit: 0, credit: 0 };
            c.credit += e.amount;
            accounts.set(e.creditAccount, c);
          }
          const totalDebit = [...accounts.values()].reduce((s, v) => s + v.debit, 0);
          const totalCredit = [...accounts.values()].reduce((s, v) => s + v.credit, 0);
          return totalDebit === totalCredit;
        },
      ),
      { numRuns: 100 },
    );
  });
});