import { Injectable } from '@nestjs/common';
import { Prisma, Wallet } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor, PolicyService } from '@/common/authz/policy.service';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
  ) {}

  async getOrCreate(tx: Prisma.TransactionClient, ownerId: string, tenantId: string, currency: string): Promise<Wallet> {
    await tx.wallet.createMany({ data: [{ ownerId, tenantId, currency }], skipDuplicates: true });
    return tx.wallet.findUniqueOrThrow({ where: { ownerId_tenantId_currency: { ownerId, tenantId, currency } } });
  }

  async lock(tx: Prisma.TransactionClient, walletId: string): Promise<Wallet> {
    await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id = ${walletId} FOR UPDATE`;
    const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) {
      throw new AppError('Wallet not found', 404, AppErrorCode.NOT_FOUND);
    }
    return wallet;
  }

  async listMine(actor: Actor) {
    const wallets = await this.prisma.wallet.findMany({
      where: { ownerId: actor.id },
      orderBy: { createdAt: 'asc' },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    return { message: 'Successfully retrieved wallets', data: wallets };
  }

  async findOne(actor: Actor, walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    if (!wallet || (wallet.ownerId !== actor.id && !this.policy.isAdmin(actor))) {
      throw new AppError('Wallet not found', 404, AppErrorCode.NOT_FOUND);
    }
    return { message: 'Successfully retrieved wallet', data: wallet };
  }

  async ledgerOf(actor: Actor, walletId: string, page: number, limit: number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId }, select: { id: true, ownerId: true } });
    if (!wallet || (wallet.ownerId !== actor.id && !this.policy.isAdmin(actor))) {
      throw new AppError('Wallet not found', 404, AppErrorCode.NOT_FOUND);
    }
    const [data, total] = await Promise.all([
      this.prisma.ledgerTransaction.findMany({
        where: { walletId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          category: true,
          direction: true,
          amount: true,
          currency: true,
          orderId: true,
          payoutId: true,
          earningId: true,
          reversalOfId: true,
          description: true,
          createdAt: true,
        },
      }),
      this.prisma.ledgerTransaction.count({ where: { walletId } }),
    ]);
    return {
      message: 'Successfully retrieved wallet ledger',
      data: { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    };
  }
}
