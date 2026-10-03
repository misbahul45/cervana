import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SNAPSHOT_QUEUE } from './snapshot.processor';

export const SNAPSHOT_CRON = '0 2 * * *';

@Injectable()
export class SnapshotScheduler implements OnModuleInit {
  private readonly logger = new Logger(SnapshotScheduler.name);

  constructor(@InjectQueue(SNAPSHOT_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    try {
      await this.queue.add(
        'nightly-snapshot',
        { trigger: 'cron' },
        {
          repeat: { pattern: SNAPSHOT_CRON, tz: 'Asia/Jakarta' },
          removeOnComplete: true,
        },
      );
      this.logger.log(`Snapshot job scheduled (${SNAPSHOT_CRON} Asia/Jakarta)`);
    } catch (err) {
      this.logger.warn(`Failed to schedule snapshot job: ${(err as Error).message}`);
    }
  }
}