import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { QuizAttemptsModule } from '../quiz-attempts/quiz-attempts.module';
import { QuestionsModule } from '../questions/questions.module';
import { QuizzesController } from './quizzes.controller';
import { QuizzesRepo } from './quizzes.repo';
import { QuizzesService } from './quizzes.service';

@Module({
  controllers: [QuizzesController],
  providers: [QuizzesRepo, QuizzesService],
  imports:[PrismaModule, QuizAttemptsModule, QuestionsModule],
  exports: [QuizzesRepo, QuizzesService],
})
export class QuizzesModule {}
