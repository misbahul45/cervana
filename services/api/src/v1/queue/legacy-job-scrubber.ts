import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JobType, Queue } from 'bullmq';
import { CREDENTIAL_KEY } from './queue-payloads';

const RETAINED_STATES: JobType[] = [
  'waiting',
  'delayed',
  'failed',
  'paused',
  'prioritized',
  'active',
  'completed',
  'waiting-children',
];

@Injectable()
export class LegacyJobScrubber implements OnApplicationBootstrap {
  private readonly logger = new Logger(LegacyJobScrubber.name);
  private readonly queues: Queue[];

  constructor(
    @InjectQueue('knowledge') knowledgeQueue: Queue,
    @InjectQueue('content') contentQueue: Queue,
    @InjectQueue('user-steps') userStepsQueue: Queue,
  ) {
    this.queues = [knowledgeQueue, contentQueue, userStepsQueue];
  }

  async onApplicationBootstrap(): Promise<void> {
    const scrubbed = await this.scrubAll();
    if (scrubbed > 0) {
      this.logger.warn(`Removed credential fields from ${scrubbed} retained queue jobs`);
    }
  }

  async scrubAll(): Promise<number> {
    let scrubbed = 0;
    for (const queue of this.queues) {
      try {
        const jobs = await queue.getJobs(RETAINED_STATES);
        for (const job of jobs) {
          const data = job?.data;
          if (!data || typeof data !== 'object') continue;
          const keys = Object.keys(data).filter((key) => CREDENTIAL_KEY.test(key));
          if (keys.length === 0) continue;
          const clean = Object.fromEntries(Object.entries(data).filter(([key]) => !CREDENTIAL_KEY.test(key)));
          await job.updateData(clean);
          scrubbed += 1;
        }
      } catch (error) {
        this.logger.error(`Could not scrub queue ${queue.name}: ${(error as Error).message}`);
      }
    }
    return scrubbed;
  }
}
