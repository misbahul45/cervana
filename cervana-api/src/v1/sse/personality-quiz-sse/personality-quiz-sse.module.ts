import { Module } from '@nestjs/common';
import { PersonalityQuizController } from './personality-quiz-sse.controller';
import { PersonalityQuizSseService } from './personality-quiz-sse.service';
import { AuthModule } from '@/v1/auth/auth.module';
import { UserStepsSseModule } from '../user-steps-sse/user-steps-sse.module';

@Module({
  imports:[AuthModule],
  controllers: [PersonalityQuizController],
  providers: [PersonalityQuizSseService],
  exports:[PersonalityQuizSseService]
})
export class PersonalityQuizSseModule {}
