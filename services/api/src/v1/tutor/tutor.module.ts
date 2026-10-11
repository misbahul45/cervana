import { Module } from '@nestjs/common';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';
import { LearnerModelModule } from '../learner-model/learner-model.module';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { MisconceptionLifecycleService } from '../misconception/misconception-lifecycle.service';
import { QuestionUnderstandingService } from '../question-intelligence/question-understanding.service';
import { QuestionBlueprintService, ThreeValuedValidatorService } from '../question-intelligence/question-blueprint.service';
import { PersonalPolicyService } from '../policy/personal-policy.service';

@Module({
  imports: [PrismaModule, LearnerModelModule],
  controllers: [TutorController],
  providers: [
    TutorService,
    MisconceptionLifecycleService,
    QuestionUnderstandingService,
    QuestionBlueprintService,
    ThreeValuedValidatorService,
    PersonalPolicyService,
  ],
  exports: [TutorService],
})
export class TutorModule {}
