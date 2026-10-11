import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOBSTATUSTYPE, ResourceType } from '@prisma/client';
import { ResourcesRepo } from '@/v1/material/resources/resources.repo';
import { AiServiceClient, deriveIdempotencyKey } from '@/common/ai-client/ai-service.client';
import { asJobError } from '../job-failure';
import { readKnowledgeJob } from '../queue-payloads';

@Processor('knowledge')
export class KnowledgeProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeProcessor.name);

  constructor(
    private readonly ai: AiServiceClient,
    private readonly resourcesRepo: ResourcesRepo,
  ) {
    super();
  }

  async process(job: Job) {
    const { resourceId, userId } = readKnowledgeJob(job.data);

    const resource = await this.resourcesRepo.update(resourceId, {
      isEmbedded: false,
      jobStatus: JOBSTATUSTYPE.PROCESSING,
    });

    if (!resource) throw new Error(`Resource ${resourceId} not found`);

    try {
      if (resource.type === ResourceType.TEXT) {
        const path = `/resources/embedding/${encodeURIComponent(resourceId)}`;
        await this.ai.post({
          path,
          actingUserId: userId,
          idempotencyKey: deriveIdempotencyKey([job.queueName, String(job.id), path, '']),
          traceId: `${job.queueName}-${job.id}`,
        });

        return { message: 'Embedding triggered directly for TEXT' };
      }

      const query = { type: resource.type, resource_id: resourceId };
      await this.ai.post({
        path: '/resources/extract',
        query,
        actingUserId: userId,
        idempotencyKey: deriveIdempotencyKey([job.queueName, String(job.id), '/resources/extract', JSON.stringify(query)]),
        traceId: `${job.queueName}-${job.id}`,
      });

      return { message: 'Extraction job triggered' };
    } catch (error) {
      await this.resourcesRepo.update(resourceId, {
        jobStatus: JOBSTATUSTYPE.FAILED,
      });
      throw asJobError(error);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
