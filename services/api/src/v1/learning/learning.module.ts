import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { UserTopicsModule } from './user-topics/user-topics.module';
import { LessonProgressModule } from './lesson-progresses/lesson-progresses.module';
import { LearningStylesModule } from './learning-styles/learning-styles.module';
import { UserStepsModule } from './user-steps/user-steps.module';
import { SubtopicProgressesModule } from './subtopic-progresses/subtopic-progresses.module';
import { PersonalityQuizzesModule } from './personality-quizzes/personality-quizzes.module';
import { StepProgressesModule } from './step-progresses/step-progresses.module';

@Module({
  imports: [
    UserTopicsModule,
    LessonProgressModule,
    RouterModule.register([
      {
        path: 'learning',
        children: [
          { path: '', module: UserTopicsModule },
          { path: '', module: LessonProgressModule },
          { path: '', module: UserStepsModule },
          { path:'', module: LearningStylesModule },
          { path:'', module: SubtopicProgressesModule },
          { path:'', module: PersonalityQuizzesModule, },
          { path:'', module: StepProgressesModule }
        ],
      },
    ]),
    SubtopicProgressesModule,
    UserStepsModule,
    LearningStylesModule,
    SubtopicProgressesModule,
    PersonalityQuizzesModule,
    StepProgressesModule,
  ],
  exports: [
    UserTopicsModule,
    LessonProgressModule,
    UserStepsModule,
    SubtopicProgressesModule,
    LearningStylesModule,
    PersonalityQuizzesModule,
  ],
})
export class LearningModule {}
