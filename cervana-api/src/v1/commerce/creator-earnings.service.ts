import { Injectable } from '@nestjs/common';
import { CreatorEarning, EarningStatus, Order, OrderItem, Prisma } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { money } from './money';

@Injectable()
export class CreatorEarningsService {
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
