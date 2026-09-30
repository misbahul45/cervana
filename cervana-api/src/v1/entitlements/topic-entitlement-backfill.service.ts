import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

export interface TopicEntitlementBackfillResult {
  candidates: number;
  inserted: number;
  skipped: number;
  withoutPaidOrder: number;
}

@Injectable()
export class TopicEntitlementBackfillService {
  private readonly logger = new Logger(TopicEntitlementBackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(): Promise<TopicEntitlementBackfillResult> {
    const [{ count: candidates }] = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM (
        SELECT DISTINCT "userId", "topicId" FROM (
          SELECT ut."userId", ut."topicId" FROM "UserTopic" ut WHERE ut."accessType" = 'PURCHASED'
          UNION
          SELECT o."userId", o."topicId"
          FROM "Order" o JOIN "Topic" t ON t.id = o."topicId"
          WHERE o.status = 'PAID' AND o."topicId" IS NOT NULL AND t.price > 0
        ) pairs
      ) distinct_pairs
    `;

    const inserted = await this.prisma.$executeRaw`
      INSERT INTO "Entitlement" (id, "userId", "resourceType", "topicId", "orderId", status, "startsAt", "expiresAt", "createdAt")
      SELECT
        gen_random_uuid()::text,
        c."userId",
        'TOPIC'::"EntitlementResourceType",
        c."topicId",
        c."orderId",
        (CASE WHEN c."expiresAt" IS NOT NULL AND c."expiresAt" <= now() THEN 'EXPIRED' ELSE 'ACTIVE' END)::"EntitlementStatus",
        COALESCE(c."startsAt", now()),
        c."expiresAt",
        now()
      FROM (
        SELECT DISTINCT ON (src."userId", src."topicId") src.*
        FROM (
          SELECT
            1 AS priority,
            ut."userId",
            ut."topicId",
            (
              SELECT o.id FROM "Order" o
              WHERE o."userId" = ut."userId" AND o."topicId" = ut."topicId" AND o.status = 'PAID'
              ORDER BY o."paidAt" DESC NULLS LAST, o."createdAt" DESC
              LIMIT 1
            ) AS "orderId",
            ut."purchasedAt" AS "startsAt",
            ut."expiredAt" AS "expiresAt"
          FROM "UserTopic" ut
          WHERE ut."accessType" = 'PURCHASED'
          UNION ALL
          SELECT
            2 AS priority,
            o."userId",
            o."topicId",
            o.id AS "orderId",
            o."paidAt" AS "startsAt",
            NULL::timestamp AS "expiresAt"
          FROM "Order" o JOIN "Topic" t ON t.id = o."topicId"
          WHERE o.status = 'PAID' AND o."topicId" IS NOT NULL AND t.price > 0
        ) src
        ORDER BY src."userId", src."topicId", src.priority
      ) c
      ON CONFLICT ("userId", "topicId") DO NOTHING
    `;

    const [{ count: withoutPaidOrder }] = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM "Entitlement" WHERE "resourceType" = 'TOPIC' AND "orderId" IS NULL
    `;

    this.logger.log(
      `Topic entitlement backfill: ${inserted} inserted, ${candidates - inserted} already present, ${withoutPaidOrder} without a paid order`,
    );
    return { candidates, inserted, skipped: candidates - inserted, withoutPaidOrder };
  }
}
