import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { bullConfig } from './queue.config';
import { QueueService } from './queue.service';
import { QUEUES } from './queues';
import { KnowledgeProcessor } from './queues/knowledge.processor';
import { ContentProcessor } from './queues/content.processor';
import { ResourcesModule } from '../material/resources/resources.module';
import { ChatModule } from '../chat/chat.module';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { UserStepsProcessor } from './queues/user-steps.processor';
import { StepsRepo } from '../curriculum/steps/steps.repo';
import { UserStepsModule } from '../learning/user-steps/user-steps.module';
import { StepsModule } from '../curriculum/steps/steps.module';
import { UserStepsSseModule } from '../sse/user-steps-sse/user-steps-sse.module';

@Module({
  imports: [
    BullModule.forRoot(bullConfig),
    BullModule.registerQueue(...QUEUES),
    forwardRef(() => ResourcesModule),
    forwardRef(() => ChatModule),
    PrismaModule,
    forwardRef(() => UserStepsModule),
    UserStepsSseModule
  ],
  providers: [
    QueueService,
    KnowledgeProcessor,
    ContentProcessor,
    UserStepsProcessor,
    StepsRepo
  ],
  exports: [QueueService],
})
export class QueueModule {}