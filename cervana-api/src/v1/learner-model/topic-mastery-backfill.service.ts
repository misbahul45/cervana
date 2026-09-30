import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

interface RawStepProgress {
  userId: string;
  topicId: string;
  progress: number;
  updatedAt: Date;
}

@Injectable()
export class TopicMasteryBackfillService {
  private readonly logger = new Logger(TopicMasteryBackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runBackfill(): Promise<{ inserted: number; skipped: number }> {
    const rows = await this.prisma.$queryRaw<RawStepProgress[]>`
      SELECT
        sp."userId" AS "userId",
        t.id          AS "topicId",
        AVG(sp.progress) AS "progress",
        MAX(sp."updatedAt") AS "updatedAt"
      FROM "StepProgress" sp
      JOIN "Step" s          ON s.id = sp."stepId"
      JOIN "SubTopic" st    ON st.id = s."subTopicId"
      JOIN "Topic" t        ON t.id = st."topicId"
      GROUP BY sp."userId", t.id
    `;

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const result = await this.upsertOne(row);
      if (result === "inserted") inserted += 1;
      else skipped += 1;
    }

    this.logger.log(
      `Backfill complete. ${inserted} rows inserted, ${skipped} skipped.`,
    );
    return { inserted, skipped };
  }

  private async upsertOne(
    row: RawStepProgress,
  ): Promise<"inserted" | "skipped"> {
    const score = Math.max(0, Math.min(1, row.progress / 100));
    const evidenceCount = 1;

    try {
      await this.prisma.topicMasteryRecord.upsert({
        where: {
          userId_topicId: {
            userId: row.userId,
            topicId: row.topicId,
          },
        },
        update: {},
        create: {
          userId: row.userId,
          topicId: row.topicId,
          score,
          confidence: 0.3,
          evidenceCount,
          lastObservedAt: row.updatedAt,
        },
      });
      return "inserted";
    } catch (e) {
      this.logger.warn(
        `Backfill conflict for user ${row.userId} topic ${row.topicId}: ${String(
          (e as Error).message,
        )}`,
      );
      return "skipped";
    }
  }
}