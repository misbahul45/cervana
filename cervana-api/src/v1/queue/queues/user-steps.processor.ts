import { errorHandler } from '@/common/lib/utils';
import { StepsRepo } from '@/v1/curriculum/steps/steps.repo';
import { CreateUserStepType } from '@/v1/learning/user-steps/user-steps.dto';
import { UserStepsRepo } from '@/v1/learning/user-steps/user-steps.repo';
import { UserStepsSseService } from '@/v1/sse/user-steps-sse/user-steps-sse.service';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Processor('user-steps')
export class UserStepsProcessor extends WorkerHost {
  constructor(
    private readonly configService: ConfigService,
    private readonly stepsRepo: StepsRepo,
    private readonly userStepsRepo: UserStepsRepo,
    private readonly userStepsSseService: UserStepsSseService
  ) {
    super();
  }

  private async retry<T>(fn: () => Promise<T>, maxRetry = 3, delayMs = 800): Promise<T> {
    let lastErr;
    for (let i = 0; i < maxRetry; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (i < maxRetry - 1) await new Promise(res => setTimeout(res, delayMs));
      }
    }
    throw lastErr;
  }

  async process(job: { data: { userId: string; token: string; topicId: string; lessonId: string; learningStyleId: string } }) {
    return errorHandler(async () => {
      const { userId, token, topicId, lessonId, learningStyleId } = job.data;
      const aiUrl = this.configService.get<string>('AI_URL');
      if (!aiUrl) throw new Error('AI_URL is not defined');

      const { data: steps } = await this.stepsRepo.findAll({ lessonId, sort:'sortOrder:asc' });

      for (const step of steps) {
        try {
          await this.retry(async () => {
            const res = await fetch(`${aiUrl}/users-steps/generate`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId,
                token,
                topicId,
                lessonId,
                learningStyleId,
                targetStepId: step.id
              }),
            });

            if (!res.ok) throw new Error(`AI error: ${res.statusText}`);

              const result = (await res.json()) as CreateUserStepType;

              const rawItems = Array.isArray(result) ? result : [result];

              const formatted = rawItems.map((item: any, index: number) => ({
                ...item,
                order: step.sortOrder * 10 + index,
                isUnlocked: step.sortOrder === 1 && index === 0
              }));

              const userSteps= await this.userStepsRepo.create(formatted);
            const isDone = step.sortOrder === steps.length;
            this.userStepsSseService.emitUpdate(userId, step.id, isDone);

            if(Array.isArray(userSteps)){
              for(const userStep of userSteps){
                const chat=userStep.chat;
                const chatMessage=chat?.messages[0]
                const res = await fetch(`${aiUrl}/learning/generate-material`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    userId,
                    topicId,
                    lessonId,
                    learningStyleId,
                    stepId: step.id,
                    userStepId: userStep.id,
                    messageId:chatMessage?.id,
                    chatId:chat?.id
                  }),
                });   
                if (!res.ok) throw new Error(`AI error: ${res.statusText}`);            
              }
            }
            return true;
          });
        } catch {}
      }

      return { message: 'Steps generation done' };
    });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: any) {
    console.log(`Job ${job.id} completed.`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: any, err: any) {
    console.error(`Job ${job.id} failed:`, err);
  }
}
