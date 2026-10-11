import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { LearnerModelController } from './learner-model.controller';
import { ConceptRegistryService } from './concepts/concept-registry.service';
import { LearnerEventsService } from './events/learner-events.service';
import { LearnerPolicyService } from './policy/learner-policy.service';
import { LearnerStateService } from './learner-state.service';

@Module({
  imports: [PrismaModule],
  controllers: [LearnerModelController],
  providers: [ConceptRegistryService, LearnerEventsService, LearnerPolicyService, LearnerStateService],
  exports: [ConceptRegistryService, LearnerEventsService, LearnerPolicyService, LearnerStateService],
})
export class LearnerModelModule {}
