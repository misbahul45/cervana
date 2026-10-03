import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SnapshotService } from './snapshot.service';

export const SNAPSHOT_QUEUE = 'analytics-snapshot';

@Processor(SNAPSHOT_QUEUE)
export class SnapshotProcessor extends WorkerHost {
  constructor(private readonly snapshots: SnapshotService) {
    super();
  }

  async process(_job: Job) {
    return this.snapshots.runAll();
  }
}