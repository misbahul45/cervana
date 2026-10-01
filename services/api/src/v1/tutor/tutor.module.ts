import { Module } from '@nestjs/common';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';
import { MasteryService } from '../learner-model/services/mastery.service';
import { MisconceptionLifecycleService } from '../misconception/misconception-lifecycle.service';
import { QuestionUnderstandingService } from '../question-intelligence/question-understanding.service';
import { QuestionBlueprintService, ThreeValuedValidatorService } from '../question-intelligence/question-blueprint.service';
import { AdaptivePolicyService } from '../policy/adaptive-policy.service';
import { PersonalPolicyService } from '../policy/personal-policy.service';

@Module({
  controllers: [TutorController],
  providers: [
    TutorService,
    MasteryService,
    MisconceptionLifecycleService,
    QuestionUnderstandingService,
    QuestionBlueprintService,
    ThreeValuedValidatorService,
    AdaptivePolicyService,
    PersonalPolicyService,
  ],
  exports: [TutorService],
})
export class TutorModule {}
