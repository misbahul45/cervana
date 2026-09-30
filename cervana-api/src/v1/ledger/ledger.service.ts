import { Injectable } from '@nestjs/common';
import { LedgerCategory, LedgerDirection, LedgerTransaction, Prisma } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { money, Money } from '../commerce/money';

export interface LedgerPostInput {
  category: LedgerCategory;
  direction: LedgerDirection;
  amount: Prisma.Decimal.Value;
  currency: string;
  idempotencyKey: string;
  walletId?: string | null;
  orderId?: string | null;
  payoutId?: string | null;
  refundId?: string | null;
  earningId?: string | null;
  description?: string | null;
  createdById?: string | null;
  traceId?: string | null;
}

export interface LedgerPostResult {
  entry: LedgerTransaction;
  created: boolean;
}

export interface ReversalMeta {
  idempotencyKey: string;
  description?: string | null;
  createdById?: string | null;
  traceId?: string | null;
}

@Injectable()
export class LedgerService {
  async post(tx: Prisma.TransactionClient, input: LedgerPostInput): Promise<LedgerPostResult> {
    const amount = money(input.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new AppError('Ledger amounts must be positive', 422, AppErrorCode.VALIDATION_ERROR);
    }

    const inserted = await tx.ledgerTransaction.createMany({
      data: [
        {
          category: input.category,
          direction: input.direction,
          amount,
          currency: input.currency,
          walletId: input.walletId ?? null,
          orderId: input.orderId ?? null,
          payoutId: input.payoutId ?? null,
          refundId: input.refundId ?? null,
          earningId: input.earningId ?? null,
          idempotencyKey: input.idempotencyKey,
          description: input.description ?? null,
          createdById: input.createdById ?? null,
          traceId: input.traceId ?? null,
        },
      ],
      skipDuplicates: true,
    });

    const entry = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (!entry) {
      throw new AppError('Ledger entry was rejected by a uniqueness rule', 409, AppErrorCode.UNIQUE_CONSTRAINT_FAILED);
    }

    if (inserted.count === 0) {
      const same =
        entry.category === input.category &&
        entry.direction === input.direction &&
        money(entry.amount).equals(amount) &&
        entry.currency === input.currency &&
        (entry.walletId ?? null) === (input.walletId ?? null);
      if (!same) {
        throw new AppError(
          'Idempotency key was already used for a different ledger entry',
          409,
          AppErrorCode.UNIQUE_CONSTRAINT_FAILED,
        );
      }
    }

    return { entry, created: inserted.count === 1 };
  }

  async reverse(tx: Prisma.TransactionClient, originalId: string, meta: ReversalMeta): Promise<LedgerPostResult> {
    const original = await tx.ledgerTransaction.findUnique({ where: { id: originalId } });
    if (!original) {
      throw new AppError('Ledger entry not found', 404, AppErrorCode.NOT_FOUND);
    }
    if (original.reversalOfId) {
      throw new AppError('A reversal cannot be reversed', 409, AppErrorCode.INVALID_STATE_TRANSITION);
    }

    const existing = await tx.ledgerTransaction.findUnique({ where: { reversalOfId: originalId } });
    if (existing) {
      return { entry: existing, created: false };
    }

    const entry = await tx.ledgerTransaction.create({
      data: {
        category: original.category,
        direction: original.direction === LedgerDirection.CREDIT ? LedgerDirection.DEBIT : LedgerDirection.CREDIT,
        amount: original.amount,
        currency: original.currency,
        walletId: original.walletId,
        orderId: original.orderId,
        payoutId: original.payoutId,
        refundId: original.refundId,
        earningId: original.earningId,
        reversalOfId: original.id,
        idempotencyKey: meta.idempotencyKey,
        description: meta.description ?? `Reversal of ${original.id}`,
        createdById: meta.createdById ?? null,
        traceId: meta.traceId ?? null,
      },
    });
    return { entry, created: true };
  }

  async balanceOfWallet(tx: Prisma.TransactionClient, walletId: string): Promise<Money> {
    const rows = await tx.ledgerTransaction.groupBy({
      by: ['direction'],
      where: { walletId },
      _sum: { amount: true },
    });
    const total = (direction: LedgerDirection) =>
      money(rows.find((row) => row.direction === direction)?._sum.amount ?? 0);
    return total(LedgerDirection.CREDIT).minus(total(LedgerDirection.DEBIT));
  }
}
