import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

export type JournalLineSide = 'DEBIT' | 'CREDIT';

export interface JournalLineInput {
  accountId: string;
  side: JournalLineSide;
  amount: number;
}

export interface JournalProposalInput {
  attemptId: string;
  periodId: string;
  description: string;
  lines: JournalLineInput[];
}

export interface JournalValidationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  net: number;
}

@Injectable()
export class AccountingSandboxService {
  constructor(private readonly prisma: PrismaService) {}

  validateJournal(input: JournalProposalInput): JournalValidationError[] {
    const errors: JournalValidationError[] = [];

    if (input.lines.length < 2) {
      errors.push({ code: 'JOURNAL_MIN_LINES', message: 'A journal entry must have at least two lines' });
    }

    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of input.lines) {
      if (line.amount <= 0) {
        errors.push({
          code: 'JOURNAL_NON_POSITIVE_AMOUNT',
          message: 'Each journal line must have a positive amount',
        });
        continue;
      }
      if (line.side === 'DEBIT') totalDebit += line.amount;
      else if (line.side === 'CREDIT') totalCredit += line.amount;
    }

    if (Math.abs(totalDebit - totalCredit) > 1e-6) {
      errors.push({
        code: 'JOURNAL_UNBALANCED',
        message: `Journal is not balanced: debit=${totalDebit} credit=${totalCredit}`,
      });
    }

    return errors;
  }

  async postJournal(input: JournalProposalInput) {
    const errors = this.validateJournal(input);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Journal validation failed',
        errors,
      });
    }

    const period = await this.prisma.sandboxPeriod.findUnique({
      where: { id: input.periodId },
    });
    if (!period) {
      throw new BadRequestException({ message: 'Period not found', code: 'PERIOD_NOT_FOUND' });
    }
    if (period.isClosed) {
      throw new BadRequestException({
        message: 'Period is closed; postings rejected',
        code: 'PERIOD_CLOSED',
      });
    }

    const accountIds = Array.from(new Set(input.lines.map((line) => line.accountId)));
    const accounts = await this.prisma.sandboxAccount.findMany({
      where: { id: { in: accountIds } },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    for (const line of input.lines) {
      const account = accountMap.get(line.accountId);
      if (!account?.isActive) {
        throw new BadRequestException({
          message: `Account ${line.accountId} is inactive or unknown`,
          code: 'ACCOUNT_INACTIVE',
        });
      }
    }

    const debitLines = input.lines.filter((line) => line.side === 'DEBIT');
    const creditLines = input.lines.filter((line) => line.side === 'CREDIT');

    return this.prisma.sandboxTransaction.create({
      data: {
        attemptId: input.attemptId,
        periodId: input.periodId,
        description: input.description,
        postedAt: new Date(),
        lines: {
          create: debitLines.map((line, idx) => ({
            debitAccountId: line.accountId,
            creditAccountId: creditLines[idx]?.accountId ?? line.accountId,
            amount: line.amount,
            sequence: idx + 1,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async trialBalance(attemptId: string): Promise<TrialBalanceRow[]> {
    const transactions = await this.prisma.sandboxTransaction.findMany({
      where: { attemptId },
      include: { lines: true },
    });

    const accountIds = Array.from(
      new Set(transactions.flatMap((t) => t.lines.flatMap((l) => [l.debitAccountId, l.creditAccountId]))),
    );
    const accounts = await this.prisma.sandboxAccount.findMany({
      where: { id: { in: accountIds } },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const balances = new Map<string, { debit: number; credit: number }>();
    for (const tx of transactions) {
      for (const line of tx.lines) {
        const debit = balances.get(line.debitAccountId) ?? { debit: 0, credit: 0 };
        debit.debit += Number(line.amount);
        balances.set(line.debitAccountId, debit);

        const credit = balances.get(line.creditAccountId) ?? { debit: 0, credit: 0 };
        credit.credit += Number(line.amount);
        balances.set(line.creditAccountId, credit);
      }
    }

    const rows: TrialBalanceRow[] = [];
    for (const [accountId, balance] of balances.entries()) {
      const account = accountMap.get(accountId);
      if (!account) continue;
      const net = balance.debit - balance.credit;
      rows.push({
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        debit: balance.debit,
        credit: balance.credit,
        net,
      });
    }

    rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    return rows;
  }

  async closePeriod(periodId: string) {
    return this.prisma.sandboxPeriod.update({
      where: { id: periodId },
      data: { isClosed: true, closedAt: new Date() },
    });
  }
}
