import { BullRootModuleOptions } from '@nestjs/bullmq';
import { JOB_OPTIONS } from './queue.service';

export const bullConfig: BullRootModuleOptions = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: JOB_OPTIONS,
};
