import { Injectable } from '@nestjs/common';
import { Prisma, ProductAccessType, ContentStatus, TenantStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { money, Money } from '../commerce/money';
import { OrderItemKind } from './orders.dto';

export interface RequestedItem {
  type: OrderItemKind;
  id: string;
}

export interface ResolvedLine {
  kind: OrderItemKind;
  productId: string;
  title: string;
  tenantId: string | null;
  creatorId: string | null;
  unitPrice: Money;
  currency: string;
  isFree: boolean;
  capacity: number | null;
}

const LEGACY_TOPIC_CURRENCY = 'IDR';

@Injectable()
export class OrderCatalogService {
  async resolve(tx: Prisma.TransactionClient, items: RequestedItem[]): Promise<ResolvedLine[]> {
    const ids = (kind: OrderItemKind) => items.filter((item) => item.type === kind).map((item) => item.id);

    const [topics, articles, classes] = await Promise.all([
      ids('TOPIC').length
        ? tx.topic.findMany({ where: { id: { in: ids('TOPIC') } }, select: { id: true, title: true, price: true } })
        : [],
      ids('ARTICLE').length
        ? tx.article.findMany({
            where: {
              id: { in: ids('ARTICLE') },
              status: ContentStatus.PUBLISHED,
              tenant: { status: TenantStatus.ACTIVE },
            },
            select: { id: true, title: true, tenantId: true, authorId: true, accessType: true, price: true, currency: true },
          })
        : [],
      ids('CLASS').length
        ? tx.classProduct.findMany({
            where: {
              id: { in: ids('CLASS') },
              status: ContentStatus.PUBLISHED,
              tenant: { status: TenantStatus.ACTIVE },
            },
            select: { id: true, title: true, tenantId: true, instructorId: true, accessType: true, price: true, currency: true, capacity: true },
          })
        : [],
    ]);

    const byKey = new Map<string, ResolvedLine>();
    for (const topic of topics) {
      const price = money(topic.price ?? 0);
      byKey.set(`TOPIC:${topic.id}`, {
        kind: 'TOPIC',
        productId: topic.id,
        title: topic.title,
        tenantId: null,
        creatorId: null,
        unitPrice: price,
        currency: LEGACY_TOPIC_CURRENCY,
        isFree: price.lessThanOrEqualTo(0),
        capacity: null,
      });
    }
    for (const article of articles) {
      const price = money(article.price ?? 0);
      byKey.set(`ARTICLE:${article.id}`, {
        kind: 'ARTICLE',
        productId: article.id,
        title: article.title,
        tenantId: article.tenantId,
        creatorId: article.authorId,
        unitPrice: price,
        currency: article.currency,
        isFree: article.accessType === ProductAccessType.FREE || price.lessThanOrEqualTo(0),
        capacity: null,
      });
    }
    for (const product of classes) {
      const price = money(product.price ?? 0);
      byKey.set(`CLASS:${product.id}`, {
        kind: 'CLASS',
        productId: product.id,
        title: product.title,
        tenantId: product.tenantId,
        creatorId: product.instructorId,
        unitPrice: price,
        currency: product.currency,
        isFree: product.accessType === ProductAccessType.FREE || price.lessThanOrEqualTo(0),
        capacity: product.capacity,
      });
    }

    return items.map((item) => {
      const line = byKey.get(`${item.type}:${item.id}`);
      if (!line) {
        throw new AppError('Product not found or not available for purchase', 404, AppErrorCode.NOT_FOUND);
      }
      return line;
    });
  }
}
