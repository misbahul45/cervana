import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { QuizAttemptsModule } from '../quiz-attempts/quiz-attempts.module';
import { QuestionsModule } from '../questions/questions.module';
import { QuizzesController } from './quizzes.controller';
import { QuizzesRepo } from './quizzes.repo';
import { QuizzesService } from './quizzes.service';
import { QuizAccessService } from '../quiz-access.service';

@Module({
  controllers: [QuizzesController],
  providers: [QuizzesRepo, QuizzesService, QuizAccessService],
  imports:[PrismaModule, QuizAttemptsModule, QuestionsModule],
  exports: [QuizzesRepo, QuizzesService],
})
export class QuizzesModule {}
