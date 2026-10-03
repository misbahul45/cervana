import { Injectable } from '@nestjs/common';

export interface LedgerEntry {
  id: string;
  amount: number;
  debitAccount: string;
  creditAccount: string;
}

export interface LedgerRepoLike {
  entriesForCompany(companyId: string, period: string): Promise<LedgerEntry[]>;
  upsertLedger(input: {
    companyId: string;
    accountName: string;
    period: string;
    debitTotal: number;
    creditTotal: number;
    balance: number;
  }): Promise<unknown>;
  listLedgers(companyId: string, period: string): Promise<Array<{
    accountName: string;
    debitTotal: number;
    creditTotal: number;
    balance: number;
  }>>;
}

export interface ClosePeriodResult {
  snapshotHash: string;
  accountCount: number;
}

export interface GeneratedStatements {
  incomeStatement: {
    period: string;
    revenue: number;
    cogs: number;
    expenses: number;
    netIncome: number;
  };
  balanceSheet: {
    assets: number;
    liabilities: number;
    equity: number;
    balanced: boolean;
  };
  cashFlow: {
    operating: number;
    investing: number;
    financing: number;
    endingCash: number;
  };
  snapshotHash: string;
}

@Injectable()
export class SimulatorEngineService {
  hashEntries(entries: LedgerEntry[]): string {
    const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
    const payload = JSON.stringify(
      sorted.map((e) => ({ id: e.id, a: e.amount, d: e.debitAccount, c: e.creditAccount })),
    );
    return Buffer.from(payload).toString('base64').slice(0, 16);
  }

  hashLedgers(ledgers: Array<{ accountName: string; debitTotal: number; creditTotal: number; balance: number }>): string {
    const sorted = [...ledgers].sort((a, b) => a.accountName.localeCompare(b.accountName));
    const payload = JSON.stringify(
      sorted.map((l) => ({ a: l.accountName, d: l.debitTotal, c: l.creditTotal, b: l.balance })),
    );
    return Buffer.from(payload).toString('base64').slice(0, 16);
  }

  async closePeriod(input: {
    companyId: string;
    period: string;
    ledgerRepo: LedgerRepoLike;
  }): Promise<ClosePeriodResult> {
    const entries = await input.ledgerRepo.entriesForCompany(input.companyId, input.period);
    const accounts = new Map<string, { debit: number; credit: number }>();
    for (const e of entries) {
      const cur = accounts.get(e.debitAccount) ?? { debit: 0, credit: 0 };
      cur.debit += Number(e.amount);
      accounts.set(e.debitAccount, cur);
      const cur2 = accounts.get(e.creditAccount) ?? { debit: 0, credit: 0 };
      cur2.credit += Number(e.amount);
      accounts.set(e.creditAccount, cur2);
    }
    const snapshotHash = this.hashEntries(entries);

    for (const [accountName, totals] of accounts) {
      await input.ledgerRepo.upsertLedger({
        companyId: input.companyId,
        accountName,
        period: input.period,
        debitTotal: totals.debit,
        creditTotal: totals.credit,
        balance: totals.debit - totals.credit,
      });
    }
    return { snapshotHash, accountCount: accounts.size };
  }

  async generateStatements(input: {
    companyId: string;
    period: string;
    ledgerRepo: LedgerRepoLike;
  }): Promise<GeneratedStatements> {
    const ledgers = await input.ledgerRepo.listLedgers(input.companyId, input.period);
    const revenue = ledgers.filter((l) =>
      l.accountName.startsWith('ServiceRevenue') || l.accountName.startsWith('SalesRevenue'),
    );
    const cogs = ledgers.filter((l) => l.accountName.startsWith('COGS'));
    const expenses = ledgers.filter((l) => l.accountName.endsWith('Expense'));

    const totalRevenue = revenue.reduce((s, l) => s + Number(l.balance), 0);
    const totalCogs = cogs.reduce((s, l) => s + Number(l.balance), 0);
    const totalExpenses = expenses.reduce((s, l) => s + Number(l.balance), 0);
    const netIncome = totalRevenue - totalCogs - totalExpenses;

    const incomeStatement = {
      period: input.period,
      revenue: totalRevenue,
      cogs: totalCogs,
      expenses: totalExpenses,
      netIncome,
    };
    const balanceSheet = this.computeBalanceSheet(ledgers, netIncome);
    const cashFlow = this.computeCashFlow(ledgers, netIncome);
    const snapshotHash = this.hashLedgers(ledgers);

    return { incomeStatement, balanceSheet, cashFlow, snapshotHash };
  }

  private computeBalanceSheet(
    ledgers: Array<{ accountName: string; balance: number }>,
    netIncome: number,
  ) {
    const assets = ledgers.filter((l) =>
      ['Cash', 'AR', 'Inventory', 'Equipment'].includes(l.accountName),
    );
    const liabilities = ledgers.filter((l) =>
      ['AP', 'LoansPayable'].includes(l.accountName),
    );
    const equity = ledgers.filter((l) =>
      ['OwnerEquity', 'RetainedEarnings'].includes(l.accountName),
    );
    const totalAssets = assets.reduce((s, l) => s + Math.max(0, Number(l.balance)), 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + Math.max(0, -Number(l.balance)), 0);
    const totalEquity = equity.reduce((s, l) => s + Math.max(0, -Number(l.balance)), 0) + netIncome;
    return {
      assets: totalAssets,
      liabilities: totalLiabilities,
      equity: totalEquity,
      balanced: totalAssets === totalLiabilities + totalEquity,
    };
  }

  private computeCashFlow(
    ledgers: Array<{ accountName: string; balance: number }>,
    netIncome: number,
  ) {
    const cash = ledgers.find((l) => l.accountName === 'Cash');
    const arChange = ledgers.find((l) => l.accountName === 'AR');
    const apChange = ledgers.find((l) => l.accountName === 'AP');
    return {
      operating:
        netIncome + Number(arChange?.balance ?? 0) - Number(apChange?.balance ?? 0),
      investing: 0,
      financing: 0,
      endingCash: Number(cash?.balance ?? 0),
    };
  }
}