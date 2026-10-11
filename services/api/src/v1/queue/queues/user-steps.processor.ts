import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { StepsRepo } from '@/v1/curriculum/steps/steps.repo';
import { UserStepsRepo } from '@/v1/learning/user-steps/user-steps.repo';
import { UserStepsSseService } from '@/v1/sse/user-steps-sse/user-steps-sse.service';
import { AiServiceClient, AiServiceRequest, deriveIdempotencyKey } from '@/common/ai-client/ai-service.client';
import { AiServiceError } from '@/common/ai-client/ai-service.error';
import { asJobError } from '../job-failure';
import { UserStepsJob, readUserStepsJob } from '../queue-payloads';

const MAX_CALL_ATTEMPTS = 3;
const GENERATE_TIMEOUT_MS = 120_000;

interface LessonStep {
  id: string;
  sortOrder: number;
}

@Processor('user-steps')
export class UserStepsProcessor extends WorkerHost {
  private readonly logger = new Logger(UserStepsProcessor.name);
  private retryDelayMs = 800;

  constructor(
    private readonly ai: AiServiceClient,
    private readonly stepsRepo: StepsRepo,
    private readonly userStepsRepo: UserStepsRepo,
    private readonly userStepsSseService: UserStepsSseService,
  ) {
    super();
  }

  private async retry<T>(call: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_CALL_ATTEMPTS; attempt += 1) {
      try {
        return await call();
      } catch (error) {
        lastError = error;
        if (error instanceof AiServiceError && !error.retryable) throw error;
        if (attempt < MAX_CALL_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
        }
      }
    }
    throw lastError;
  }

  private request(job: Job, userId: string, path: string, body: Record<string, unknown>, timeoutMs?: number): AiServiceRequest {
    return {
      path,
      body,
      actingUserId: userId,
      idempotencyKey: deriveIdempotencyKey([job.queueName, String(job.id), path, JSON.stringify(body)]),
      traceId: `${job.queueName}-${job.id}`,
      timeoutMs,
    };
  }

  private userStepItems(generated: unknown): Record<string, unknown>[] {
    const items = Array.isArray(generated) ? generated : [generated];
    const valid = items.length > 0 && items.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item));
    if (!valid) throw new AiServiceError('AI service returned no user steps', null, true);
    return items as Record<string, unknown>[];
  }

  private async generateForStep(job: Job, data: UserStepsJob, step: LessonStep, stepCount: number) {
    const { userId, topicId, lessonId, learningStyleId } = data;

    const generated = await this.retry(() =>
      this.ai.post<unknown>(
        this.request(job, userId, '/users-steps/generate', { topicId, lessonId, learningStyleId, targetStepId: step.id }, GENERATE_TIMEOUT_MS),
      ),
    );

    const rows = this.userStepItems(generated).map((item, index) => ({
      ...item,
      order: step.sortOrder * 10 + index,
      isUnlocked: step.sortOrder === 1 && index === 0,
    }));
    const created = await this.userStepsRepo.create(rows as any);
    this.userStepsSseService.emitUpdate(userId, step.id, step.sortOrder === stepCount);

    for (const userStep of Array.isArray(created) ? created : [created]) {
      const chat = userStep.chat;
      const message = chat?.messages[0];
      await this.retry(() =>
        this.ai.post(
          this.request(job, userId, '/learning/generate-material', {
            topicId,
            lessonId,
            learningStyleId,
            stepId: step.id,
            userStepId: userStep.id,
            messageId: message?.id,
            chatId: chat?.id,
          }),
        ),
      );
    }
  }

  async process(job: Job) {
    const data = readUserStepsJob(job.data);
    const { data: steps } = await this.stepsRepo.findAll({ lessonId: data.lessonId, sort: 'sortOrder:asc' });

    const failedSteps: string[] = [];
    let lastError: unknown;
    for (const step of steps as LessonStep[]) {
      try {
        await this.generateForStep(job, data, step, steps.length);
      } catch (error) {
        lastError = error;
        failedSteps.push(step.id);
        this.logger.error(`Job ${job.id}: step ${step.id} failed: ${(error as Error).message}`);
      }
    }

    if (steps.length > 0 && failedSteps.length === steps.length) {
      throw asJobError(lastError);
    }

    return { message: 'Steps generation done', failedSteps };
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
