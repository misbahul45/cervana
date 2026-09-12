import { Module } from '@nestjs/common';
import { QuizAttemptsService } from './quiz-attempts.service';
import { QuizAttemptsController } from './quiz-attempts.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { QuizAttemptsRepo } from './quiz-attempts.repo';

@Module({
  controllers: [QuizAttemptsController],
  providers: [QuizAttemptsService, QuizAttemptsRepo],
  imports:[PrismaModule],
  exports: [QuizAttemptsService, QuizAttemptsRepo]
})
export class QuizAttemptsModule {}
