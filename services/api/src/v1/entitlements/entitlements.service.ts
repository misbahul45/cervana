import { Injectable } from '@nestjs/common';
import { EntitlementResourceType, Order, OrderItem, Prisma } from '@prisma/client';

const HOUR_MS = 60 * 60 * 1000;

export interface GrantedEntitlement {
  resourceType: EntitlementResourceType;
  resourceId: string;
}

export interface EntitledResource {
  articleId?: string;
  classId?: string;
  topicId?: string;
}

@Injectable()
export class EntitlementsService {
  async hasActiveAccess(
    client: Pick<Prisma.TransactionClient, 'entitlement'>,
    userId: string,
    resource: EntitledResource,
    now: Date = new Date(),
  ): Promise<boolean> {
    const row = await client.entitlement.findFirst({
      where: {
        userId,
        ...resource,
        status: 'ACTIVE',
        startsAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    return row !== null;
  }

  async grantForOrder(
    tx: Prisma.TransactionClient,
    order: Pick<Order, 'id' | 'userId'>,
    items: OrderItem[],
    grantedAt: Date,
  ): Promise<GrantedEntitlement[]> {
    const granted: GrantedEntitlement[] = [];
    for (const item of items) {
      if (item.topicId) {
        await this.grantTopic(tx, order, item.topicId, grantedAt);
        granted.push({ resourceType: EntitlementResourceType.TOPIC, resourceId: item.topicId });
      } else if (item.articleId) {
        await tx.entitlement.upsert({
          where: { userId_articleId: { userId: order.userId, articleId: item.articleId } },
          create: {
            userId: order.userId,
            tenantId: item.tenantId,
            resourceType: EntitlementResourceType.ARTICLE,
            articleId: item.articleId,
            orderId: order.id,
            status: 'ACTIVE',
            startsAt: grantedAt,
          },
          update: { orderId: order.id, status: 'ACTIVE', startsAt: grantedAt, expiresAt: null },
        });
        granted.push({ resourceType: EntitlementResourceType.ARTICLE, resourceId: item.articleId });
      } else if (item.classId) {
        await tx.entitlement.upsert({
          where: { userId_classId: { userId: order.userId, classId: item.classId } },
          create: {
            userId: order.userId,
            tenantId: item.tenantId,
            resourceType: EntitlementResourceType.CLASS,
            classId: item.classId,
            orderId: order.id,
            status: 'ACTIVE',
            startsAt: grantedAt,
          },
          update: { orderId: order.id, status: 'ACTIVE', startsAt: grantedAt, expiresAt: null },
        });
        granted.push({ resourceType: EntitlementResourceType.CLASS, resourceId: item.classId });
      }
    }
    return granted;
  }

  private async grantTopic(
    tx: Prisma.TransactionClient,
    order: Pick<Order, 'id' | 'userId'>,
    topicId: string,
    grantedAt: Date,
  ) {
    const topic = await tx.topic.findUnique({ where: { id: topicId }, select: { topicDuration: true } });
    const expiresAt = topic?.topicDuration ? new Date(grantedAt.getTime() + topic.topicDuration * HOUR_MS) : null;

    await tx.userTopic.upsert({
      where: { userId_topicId: { userId: order.userId, topicId } },
      create: {
        userId: order.userId,
        topicId,
        accessType: 'PURCHASED',
        status: 'NOT_STARTED',
        progressPercent: 0,
        purchasedAt: grantedAt,
        expiredAt: expiresAt,
      },
      update: { accessType: 'PURCHASED', purchasedAt: grantedAt, expiredAt: expiresAt },
    });

    await tx.entitlement.upsert({
      where: { userId_topicId: { userId: order.userId, topicId } },
      create: {
        userId: order.userId,
        resourceType: EntitlementResourceType.TOPIC,
        topicId,
        orderId: order.id,
        status: 'ACTIVE',
        startsAt: grantedAt,
        expiresAt,
      },
      update: { orderId: order.id, status: 'ACTIVE', startsAt: grantedAt, expiresAt },
    });
  }
}
