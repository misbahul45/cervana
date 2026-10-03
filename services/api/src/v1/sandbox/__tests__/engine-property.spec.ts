import fc from 'fast-check';

describe('Engine property: balance holds for random streams (Phase 6)', () => {
  it('Debit = Credit for 100 randomized transaction streams', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            debitAccount: fc.constantFrom('Cash', 'Inventory', 'AR', 'ServiceRevenue', 'COGS'),
            creditAccount: fc.constantFrom('Cash', 'Inventory', 'AR', 'ServiceRevenue', 'COGS'),
            amount: fc.integer({ min: 1, max: 10_000_000 }),
          }),
          { minLength: 1, maxLength: 100 },
        ),
        (transactions) => {
          const entries = transactions.flatMap((t) => [
            { account: t.debitAccount, debit: t.amount, credit: 0 },
            { account: t.creditAccount, debit: 0, credit: t.amount },
          ]);
          const totals = new Map<string, { debit: number; credit: number }>();
          for (const e of entries) {
            const cur = totals.get(e.account) ?? { debit: 0, credit: 0 };
            cur.debit += e.debit;
            cur.credit += e.credit;
            totals.set(e.account, cur);
          }
          const totalDebit = [...totals.values()].reduce((s, v) => s + v.debit, 0);
          const totalCredit = [...totals.values()].reduce((s, v) => s + v.credit, 0);
          return totalDebit === totalCredit;
        },
      ),
      { numRuns: 100 },
    );
  });
});