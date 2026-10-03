import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { AdminAnalyticsController } from './admin/admin-analytics.controller';
import { CreatorAnalyticsController } from './creator/creator-analytics.controller';
import { EventLogController } from './events/event-log.controller';
import { EventLogService } from './events/event-log.service';
import { SnapshotController } from './snapshots/snapshot.controller';
import { SnapshotService } from './snapshots/snapshot.service';
import { SnapshotProcessor, SNAPSHOT_QUEUE } from './snapshots/snapshot.processor';
import { SnapshotScheduler } from './snapshots/snapshot.scheduler';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: SNAPSHOT_QUEUE })],
  controllers: [
    CreatorAnalyticsController,
    AdminAnalyticsController,
    EventLogController,
    SnapshotController,
  ],
  providers: [EventLogService, SnapshotService, SnapshotProcessor, SnapshotScheduler],
  exports: [EventLogService, SnapshotService],
})
export class AnalyticsModule {}