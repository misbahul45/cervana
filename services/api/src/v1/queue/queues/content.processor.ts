import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { JOBSTATUSTYPE } from '@prisma/client';
import { ContentsRepo } from '@/v1/chat/contents/contents.repo';

interface ContentJob {
  contentId: string;
  chatId: string;
  textContent: string;
}

@Processor('content')
export class ContentProcessor extends WorkerHost {
  constructor(
    private readonly configService: ConfigService,
    private readonly contentsRepo: ContentsRepo,
  ) {
    super();
  }

  async process(job: { data: ContentJob }) {
    const { contentId, chatId } = job.data;
    const aiUrl = this.configService.get<string>('AI_URL');
    if (!aiUrl) {
      throw new Error('AI_URL is not defined');
    }

    await this.contentsRepo.update(contentId, {
      jobStatus: JOBSTATUSTYPE.PROCESSING,
    });

    try {
      const res = await fetch(`${aiUrl}/v1/resources/embedding/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId,
          chatId,
          text: job.data.textContent,
        }),
      });

      if (!res.ok) {
        throw new Error(`Embedding endpoint returned ${res.status}`);
      }

      await this.contentsRepo.update(contentId, {
        isEmbedded: true,
        embeddingAt: new Date(),
        jobStatus: JOBSTATUSTYPE.SUCCESS,
      });

      return { message: 'Content embedded', contentId };
    } catch (e) {
      await this.contentsRepo.update(contentId, {
        jobStatus: JOBSTATUSTYPE.FAILED,
      });
      throw e;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: any) {
    console.log(`Content job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: any, err: any) {
    console.error(`Content job ${job.id} failed:`, err);
  }
}