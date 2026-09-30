import { Injectable } from '@nestjs/common';
import {
  CreatorEarning,
  EarningStatus,
  LedgerCategory,
  LedgerDirection,
  Order,
  OrderItem,
  Prisma,
} from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../ledger/wallet.service';
import { money } from './money';

export interface ReleaseContext {
  actorId?: string | null;
  traceId?: string | null;
}

@Injectable()
export class CreatorEarningsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletService,
  ) {}

  async recordForOrder(
    tx: Prisma.TransactionClient,
    order: Pick<Order, 'id' | 'currency'>,
    items: OrderItem[],
  ): Promise<CreatorEarning[]> {
    const tenantItems = items.filter((item) => item.tenantId);
    if (tenantItems.length === 0) {
      return [];
    }

    const creators = await this.resolveCreators(tx, tenantItems);

    await tx.creatorEarning.createMany({
      data: tenantItems.map((item) => {
        const gross = money(item.totalPrice);
        const fee = money(item.platformFee);
        return {
          tenantId: item.tenantId!,
          creatorId: creators.get(item.id)!,
          orderId: order.id,
          orderItemId: item.id,
          grossAmount: gross,
          platformFee: fee,
          creatorAmount: gross.minus(fee),
          currency: order.currency,
          status: EarningStatus.PENDING,
        };
      }),
      skipDuplicates: true,
    });

    return tx.creatorEarning.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } });
  }

  async release(tx: Prisma.TransactionClient, earning: CreatorEarning, ctx: ReleaseContext = {}) {
    if (earning.status !== EarningStatus.PENDING) {
      return { released: false, earning };
    }

    const wallet = await this.wallets.getOrCreate(tx, earning.creatorId, earning.tenantId, earning.currency);
    const creatorAmount = money(earning.creatorAmount);

    if (creatorAmount.greaterThan(0)) {
      await this.ledger.post(tx, {
        category: LedgerCategory.WALLET_CREDIT,
        direction: LedgerDirection.CREDIT,
        amount: creatorAmount,
        currency: earning.currency,
        walletId: wallet.id,
        orderId: earning.orderId,
        earningId: earning.id,
        idempotencyKey: `wallet-credit:${earning.id}`,
        description: 'Creator earning released to wallet',
        createdById: ctx.actorId ?? null,
        traceId: ctx.traceId ?? null,
      });
    }

    const released = await tx.creatorEarning.update({
      where: { id: earning.id },
      data: { status: EarningStatus.AVAILABLE, releasedAt: new Date() },
    });
    return { released: true, earning: released };
  }

  async releaseDue(holdDays: number, limit = 200, now: Date = new Date(), ctx: ReleaseContext = {}): Promise<number> {
    const cutoff = new Date(now.getTime() - holdDays * 24 * 60 * 60 * 1000);
    const due = await this.prisma.creatorEarning.findMany({
      where: { status: EarningStatus.PENDING, createdAt: { lte: cutoff } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
      take: limit,
    });

    let released = 0;
    for (const { id } of due) {
      const outcome = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "CreatorEarning" WHERE id = ${id} FOR UPDATE`;
        const earning = await tx.creatorEarning.findUniqueOrThrow({ where: { id } });
        return this.release(tx, earning, ctx);
      });
      if (outcome.released) released += 1;
    }
    return released;
  }

  private async resolveCreators(tx: Prisma.TransactionClient, items: OrderItem[]): Promise<Map<string, string>> {
    const articleIds = items.flatMap((item) => (item.articleId ? [item.articleId] : []));
    const classIds = items.flatMap((item) => (item.classId ? [item.classId] : []));
    const tenantIds = [...new Set(items.map((item) => item.tenantId!))];

    const [articles, classes, tenants] = await Promise.all([
      articleIds.length
        ? tx.article.findMany({ where: { id: { in: articleIds } }, select: { id: true, authorId: true } })
        : [],
      classIds.length
        ? tx.classProduct.findMany({ where: { id: { in: classIds } }, select: { id: true, instructorId: true } })
        : [],
      tx.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, ownerId: true } }),
    ]);

    const authors = new Map<string, string>(articles.map((article) => [article.id, article.authorId] as [string, string]));
    const instructors = new Map<string, string>(
      classes.map((product) => [product.id, product.instructorId] as [string, string]),
    );
    const owners = new Map<string, string>(tenants.map((tenant) => [tenant.id, tenant.ownerId] as [string, string]));

    const resolved = new Map<string, string>();
    for (const item of items) {
      const creatorId =
        (item.articleId ? authors.get(item.articleId) : undefined) ??
        (item.classId ? instructors.get(item.classId) : undefined) ??
        owners.get(item.tenantId!);
      if (!creatorId) {
        throw new AppError('Creator for the order item could not be resolved', 409, AppErrorCode.INVALID_STATE_TRANSITION);
      }
      resolved.set(item.id, creatorId);
    }
    return resolved;
  }
}
