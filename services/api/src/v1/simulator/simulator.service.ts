import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { SimulatorEngineService, LedgerRepoLike } from './simulator-engine.service';

export const SIMULATOR_SCENARIOS: ReadonlyArray<{ slug: string; name: string; days: number }> = [
  { slug: 'starter-30d', name: 'Starter 30 hari', days: 30 },
  { slug: 'standard-60d', name: 'Standard 60 hari', days: 60 },
  { slug: 'pro-90d', name: 'Pro 90 hari', days: 90 },
];

@Injectable()
export class SimulatorService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly engine: SimulatorEngineService = new SimulatorEngineService(),
  ) {}

  listScenarios() {
    return SIMULATOR_SCENARIOS.map((s) => ({ ...s }));
  }

  async createCompany(input: { ownerId: string; tenantId: string; scenarioSlug: string; days?: number }) {
    const scenario = SIMULATOR_SCENARIOS.find((s) => s.slug === input.scenarioSlug);
    const days = input.days ?? scenario?.days ?? 30;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + days * 86_400_000);
    return this.prisma.virtualCompany.create({
      data: {
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        name: `Simulasi ${startDate.toISOString().slice(0, 10)}`,
        scenarioSlug: input.scenarioSlug,
        startDate,
        endDate,
      },
    });
  }

  async getCompany(companyId: string, tenantId: string) {
    return this.prisma.virtualCompany.findFirst({
      where: { id: companyId, tenantId },
    });
  }

  async listEntries(companyId: string, tenantId: string) {
    await this.assertCompany(companyId, tenantId);
    return this.prisma.journalEntry.findMany({
      where: { companyId },
      orderBy: { date: 'asc' },
    });
  }

  async addEntry(
    companyId: string,
    tenantId: string,
    body: { date: string; debitAccount: string; creditAccount: string; amount: number; memo?: string },
  ) {
    await this.assertCompany(companyId, tenantId);
    return this.prisma.journalEntry.create({
      data: {
        companyId,
        date: new Date(body.date),
        debitAccount: body.debitAccount,
        creditAccount: body.creditAccount,
        amount: body.amount,
        memo: body.memo,
      },
    });
  }

  async closePeriod(companyId: string, tenantId: string, period: string) {
    await this.assertCompany(companyId, tenantId);
    return this.engine.closePeriod({
      companyId,
      period,
      ledgerRepo: this.ledgerRepo(),
    });
  }

  async generateStatements(companyId: string, tenantId: string, period: string) {
    await this.assertCompany(companyId, tenantId);
    const result = await this.engine.generateStatements({
      companyId,
      period,
      ledgerRepo: this.ledgerRepo(),
    });
    await this.persistStatements(companyId, period, result.snapshotHash, {
      INCOME_STATEMENT: result.incomeStatement,
      BALANCE_SHEET: result.balanceSheet,
      CASH_FLOW: result.cashFlow,
    });
    return result;
  }

  private ledgerRepo(): LedgerRepoLike {
    return {
      entriesForCompany: async (companyId, period) => {
        const { start, end } = periodBounds(period);
        const rows = await this.prisma.journalEntry.findMany({
          where: {
            companyId,
            date: { gte: start, lte: end },
          },
          orderBy: { createdAt: 'asc' },
        });
        return rows.map((r) => ({
          id: r.id,
          amount: Number(r.amount),
          debitAccount: r.debitAccount,
          creditAccount: r.creditAccount,
        }));
      },
      upsertLedger: async (data) =>
        this.prisma.ledger.upsert({
          where: {
            companyId_accountName_period: {
              companyId: data.companyId,
              accountName: data.accountName,
              period: data.period,
            },
          },
          update: {
            debitTotal: data.debitTotal,
            creditTotal: data.creditTotal,
            balance: data.balance,
          },
          create: {
            companyId: data.companyId,
            accountName: data.accountName,
            period: data.period,
            debitTotal: data.debitTotal,
            creditTotal: data.creditTotal,
            balance: data.balance,
          },
        }),
      listLedgers: async (companyId, period) => {
        const rows = await this.prisma.ledger.findMany({
          where: { companyId, period },
          orderBy: { accountName: 'asc' },
        });
        return rows.map((l) => ({
          accountName: l.accountName,
          debitTotal: Number(l.debitTotal),
          creditTotal: Number(l.creditTotal),
          balance: Number(l.balance),
        }));
      },
    };
  }

  private async assertCompany(companyId: string, tenantId: string) {
    const company = await this.prisma.virtualCompany.findFirst({
      where: { id: companyId, tenantId },
    });
    if (!company) throw new Error('company_not_found_or_cross_tenant');
  }

  private async persistStatements(
    companyId: string,
    period: string,
    snapshotHash: string,
    rows: Record<'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW', unknown>,
  ) {
    for (const [statementType, data] of Object.entries(rows)) {
      await this.prisma.financialStatement.upsert({
        where: {
          companyId_period_statementType: {
            companyId,
            period,
            statementType: statementType as 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW',
          },
        },
        update: { data: data as any, snapshotHash },
        create: {
          companyId,
          period,
          statementType: statementType as 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW',
          data: data as any,
          snapshotHash,
        },
      });
    }
  }
}

export function periodBounds(period: string): { start: Date; end: Date } {
  const [year, month] = period.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}