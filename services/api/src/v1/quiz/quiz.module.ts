import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { QuestionsModule } from './questions/questions.module';
import { QuizAttemptsModule } from './quiz-attempts/quiz-attempts.module';
import { AnswersModule } from './answers/answers.module';
import { QuizzesModule } from './quizzes/Quizzes.module';
import { QuizEvaluationService } from './services/quiz-evaluation.service';

@Module({
  imports: [
    QuizzesModule,
    QuestionsModule,
    QuizAttemptsModule,
    AnswersModule,
    RouterModule.register([
      {
        path: 'quiz',
        children: [
          { path: '', module: QuizzesModule },
          { path: '', module: QuestionsModule },
          { path: '', module: QuizAttemptsModule },
          { path: '', module: AnswersModule },
        ],
      },
    ]),
  ],
  providers: [QuizEvaluationService],
  exports: [QuizEvaluationService],
})
export class QuizModule {}