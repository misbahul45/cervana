import { Module } from '@nestjs/common';
import { ResourcesModule } from '../material/resources/resources.module';
import { LessonsModule } from '../curriculum/lessons/lessons.module';
import { StepsModule } from '../curriculum/steps/steps.module';
import { UserStepsModule } from '../learning/user-steps/user-steps.module';
import { LearningStylesModule } from '../learning/learning-styles/learning-styles.module';
import { PersonalityQuizzesModule } from '../learning/personality-quizzes/personality-quizzes.module';
import { ContentsModule } from '../chat/contents/contents.module';
import { ChatMessagesModule } from '../chat/chat-messages/chat-messages.module';
import { ChatMessagesSseModule } from '../sse/chat-messages-sse/chat-messages-sse.module';
import { ContentSseModule } from '../sse/content-sse/content-sse.module';
import { PersonalityQuizSseModule } from '../sse/personality-quiz-sse/personality-quiz-sse.module';
import { InternalResourcesController } from './internal-resources.controller';
import { InternalEpisodesController } from './internal-episodes.controller';
import { InternalDecisionTracesController } from './internal-decision-traces.controller';
import { InternalAgentSessionsController } from './internal-agent-sessions.controller';
import { InternalCurriculumController } from './internal-curriculum.controller';
import { InternalLearnerReadsController } from './internal-learner-reads.controller';
import { InternalLearnerWritesController } from './internal-learner-writes.controller';
import { InternalLearnerStateController } from './internal-learner-state.controller';
import { LearnerModelModule } from '../learner-model/learner-model.module';
import { InternalServiceGuard } from '@/common/authz/internal-service.guard';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { IdempotencyModule } from '@/common/idempotency/idempotency.module';
import { AuthzModule } from '@/common/authz/authz.module';

@Module({
  imports: [
    ResourcesModule,
    LessonsModule,
    StepsModule,
    UserStepsModule,
    LearningStylesModule,
    PersonalityQuizzesModule,
    ContentsModule,
    ChatMessagesModule,
    ChatMessagesSseModule,
    ContentSseModule,
    PersonalityQuizSseModule,
    PrismaModule,
    IdempotencyModule,
    AuthzModule,
    LearnerModelModule,
  ],
  controllers: [
    InternalResourcesController,
    InternalEpisodesController,
    InternalDecisionTracesController,
    InternalAgentSessionsController,
    InternalCurriculumController,
    InternalLearnerReadsController,
    InternalLearnerWritesController,
    InternalLearnerStateController,
  ],
  providers: [InternalServiceGuard],
})
export class InternalModule {}
