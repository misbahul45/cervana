import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AICreditEntryType, Prisma, type AICreditLedgerEntry } from '@prisma/client';
import { PrismaService } from '@/common/config/prisma/prisma.service';

export interface ReserveRequest {
  userId: string;
  amount: number;
  sourceType: string;
  sourceId?: string;
  operationId: string;
}

export interface ReserveResult {
  ok: true;
  reservationId: string;
}

export interface RejectResult {
  ok: false;
  available: number;
}

export interface SettleRequest {
  userId: string;
  reservationId: string;
  actualAmount: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AiCreditsService {
  private readonly logger = new Logger(AiCreditsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string) {
    let wallet = await this.prisma.aICreditWallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await this.prisma.aICreditWallet.create({ data: { userId } });
    }
    return {
      userId,
      balance: wallet.balance,
      reserved: wallet.reserved,
      available: wallet.balance - wallet.reserved,
      lifetimeEarned: wallet.lifetimeEarned,
      lifetimePurchased: wallet.lifetimePurchased,
      lifetimeSpent: wallet.lifetimeSpent,
    };
  }

  async reserve(req: ReserveRequest): Promise<ReserveResult | RejectResult> {
    if (req.amount <= 0) throw new BadRequestException('amount must be > 0');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`aicredit-wallet:${req.userId}`}, 0))`;
      const wallet = await this.ensureWallet(tx, req.userId);
      const available = wallet.balance - wallet.reserved;
      if (available < req.amount) {
        return { ok: false as const, available };
      }
      const reservation = await tx.aICreditLedgerEntry.create({
        data: {
          userId: req.userId,
          type: AICreditEntryType.SPEND,
          amount: req.amount,
          balanceAfter: wallet.balance - req.amount,
          sourceType: req.sourceType,
          sourceId: req.sourceId ?? null,
          idempotencyKey: `reserve:${req.operationId}`,
          metadata: { state: 'RESERVED' } as Prisma.InputJsonValue,
        },
      });
      await tx.aICreditWallet.update({
        where: { userId: req.userId },
        data: { reserved: { increment: req.amount } },
      });
      return { ok: true as const, reservationId: reservation.id };
    });

    if (!result.ok) {
      this.logger.warn(
        `Reserve rejected user=${req.userId} amount=${req.amount} available=${result.available}`,
      );
    }
    return result;
  }

  async settle(req: SettleRequest): Promise<AICreditLedgerEntry> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.aICreditLedgerEntry.findUnique({
        where: { id: req.reservationId },
      });
      if (!reservation) throw new BadRequestException('reservation not found');
      if (reservation.userId !== req.userId) throw new BadRequestException('reservation user mismatch');
      if (reservation.type !== AICreditEntryType.SPEND) {
        throw new BadRequestException('reservation already settled');
      }

      const held = reservation.amount;
      const refund = Math.max(0, held - req.actualAmount);
      const spend = Math.min(held, req.actualAmount);
      const wallet = await tx.aICreditWallet.findUniqueOrThrow({ where: { userId: req.userId } });

      const newBalance = wallet.balance - spend;

      await tx.aICreditWallet.update({
        where: { userId: req.userId },
        data: {
          balance: newBalance,
          reserved: { decrement: held },
          lifetimeSpent: { increment: spend },
        },
      });

      if (refund > 0) {
        await tx.aICreditLedgerEntry.create({
          data: {
            userId: req.userId,
            type: AICreditEntryType.REFUND,
            amount: refund,
            balanceAfter: newBalance,
            sourceType: reservation.sourceType,
            sourceId: reservation.sourceId ?? null,
            idempotencyKey: `refund:${req.reservationId}`,
            metadata: { state: 'REFUND' } as Prisma.InputJsonValue,
          },
        });
      }

      return tx.aICreditLedgerEntry.update({
        where: { id: req.reservationId },
        data: {
          amount: spend,
          balanceAfter: newBalance,
          metadata: { state: 'SETTLED', refund, ...(req.metadata ?? {}) } as Prisma.InputJsonValue,
        },
      });
    });
  }

  async release(reservationId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.aICreditLedgerEntry.findUnique({
        where: { id: reservationId },
      });
      if (!reservation) return;
      if (reservation.type !== AICreditEntryType.SPEND) return;

      await tx.aICreditWallet.update({
        where: { userId: reservation.userId },
        data: { reserved: { decrement: reservation.amount } },
      });

      await tx.aICreditLedgerEntry.update({
        where: { id: reservationId },
        data: {
          metadata: { state: 'RELEASED', reason } as Prisma.InputJsonValue,
        },
      });
    });
  }

  async topUp(args: {
    userId: string;
    amount: number;
    sourceType: 'PURCHASE' | 'BONUS' | 'REFUND' | 'EARN' | 'EXPIRE';
    idempotencyKey: string;
    sourceId?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (args.amount <= 0) throw new BadRequestException('amount must be > 0');

    return this.prisma.$transaction(async (tx) => {
      const wallet = await this.ensureWallet(tx, args.userId);
      const newBalance = wallet.balance + args.amount;

      await tx.aICreditWallet.update({
        where: { userId: args.userId },
        data: {
          balance: newBalance,
          lifetimePurchased:
            args.sourceType === 'PURCHASE' ? { increment: args.amount } : wallet.lifetimePurchased,
          lifetimeEarned:
            args.sourceType === 'EARN' || args.sourceType === 'BONUS'
              ? { increment: args.amount }
              : wallet.lifetimeEarned,
        },
      });

      return tx.aICreditLedgerEntry.create({
        data: {
          userId: args.userId,
          type: this.toEntryType(args.sourceType),
          amount: args.amount,
          balanceAfter: newBalance,
          sourceType: args.sourceType,
          sourceId: args.sourceId ?? null,
          idempotencyKey: args.idempotencyKey,
          metadata: (args.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    });
  }

  async ledger(userId: string, options: { limit: number }) {
    return this.prisma.aICreditLedgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
    });
  }

  private async ensureWallet(
    tx: Prisma.TransactionClient | PrismaService,
    userId: string,
  ) {
    const existing = await tx.aICreditWallet.findUnique({ where: { userId } });
    if (existing) return existing;
    return tx.aICreditWallet.create({ data: { userId } });
  }

  private toEntryType(source: 'PURCHASE' | 'BONUS' | 'REFUND' | 'EARN' | 'EXPIRE'): AICreditEntryType {
    switch (source) {
      case 'PURCHASE':
        return AICreditEntryType.PURCHASE;
      case 'BONUS':
        return AICreditEntryType.BONUS;
      case 'REFUND':
        return AICreditEntryType.REFUND;
      case 'EARN':
        return AICreditEntryType.EARN;
      case 'EXPIRE':
        return AICreditEntryType.EXPIRE;
    }
  }
}
