import { Module } from '@nestjs/common';
import { QuizEvaluationService } from './quiz-evaluation.service';

@Module({
  providers: [QuizEvaluationService],
  exports: [QuizEvaluationService],
})
export class QuizModule {}
