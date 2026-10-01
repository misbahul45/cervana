import { ResourcesRepo } from '@/v1/material/resources/resources.repo';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { JOBSTATUSTYPE, ResourceType } from '@prisma/client';

@Processor('knowledge')
export class KnowledgeProcessor extends WorkerHost {
  constructor(
    private readonly configService: ConfigService,
    private readonly resourcesRepo: ResourcesRepo
  ) {
    super();
  }

  async process(job: { data: { resourceId: string; token: string } }) {
    const { resourceId, token } = job.data;
    const aiUrl = this.configService.get<string>('AI_URL');
    if (!aiUrl) throw new Error('❌ AI_URL is not defined');

    const resource = await this.resourcesRepo.update(resourceId, {
      isEmbedded: false,
      jobStatus: JOBSTATUSTYPE.PROCESSING,
    });

    if (!resource) throw new Error(`❌ Resource ${resourceId} not found`);

    try {
      if (resource.type === ResourceType.TEXT) {
        await fetch(`${aiUrl}/resources/embedding/${resourceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        return { message: 'Embedding triggered directly for TEXT' };
      }

      const extractUrl = `${aiUrl}/resources/extract?type=${resource.type}&resource_id=${resourceId}`;


      const res = await fetch(extractUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Extraction request failed: ${res.statusText}`);

      return { message: 'Extraction job triggered' };
    } catch (error) {
      await this.resourcesRepo.update(resourceId, {
        jobStatus: JOBSTATUSTYPE.FAILED,
      });
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: any) {
    console.log(`✅ [KnowledgeWorker] Job ${job.id} completed successfully.`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: any, err: any) {
    console.error(`❌ [KnowledgeWorker] Job ${job.id} failed:`, err);
  }
}
