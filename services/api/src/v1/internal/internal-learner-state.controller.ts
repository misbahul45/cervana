import { Controller, Get, Query, Req } from '@nestjs/common';
import { InternalActing } from '@/common/authz/internal-acting.decorator';
import { InternalOnly } from '@/common/authz/internal-service.guard';
import { ConceptRegistryService } from '../learner-model/concepts/concept-registry.service';
import { LearnerStateService } from '../learner-model/learner-state.service';

const PYTHON_SCHEME = 'PYTHON_DOMAIN';

@Controller('internal')
export class InternalLearnerStateController {
  constructor(
    private readonly registry: ConceptRegistryService,
    private readonly state: LearnerStateService,
  ) {}

  @Get('concepts')
  @InternalOnly()
  async concepts() {
    const [concepts, pythonAliases] = await Promise.all([this.registry.listActive(), this.registry.approvedAliases(PYTHON_SCHEME)]);
    return { message: 'Concept registry', data: { concepts, aliases: { [PYTHON_SCHEME]: pythonAliases } } };
  }

  @Get('learner-state')
  @InternalActing()
  async learnerState(
    @Req() req: { user: { id: string } },
    @Query('conceptId') conceptId?: string,
    @Query('lessonId') lessonId?: string,
    @Query('userStepId') userStepId?: string,
  ) {
    const userId = req.user.id;
    const lessonConcepts = lessonId ? (await this.registry.conceptsForLesson(lessonId)).conceptIds : [];
    const stepConcepts = userStepId ? await this.state.conceptIdsForUserStep(userId, userStepId) : [];
    const wanted = [...new Set([...(conceptId ? [conceptId] : []), ...lessonConcepts, ...stepConcepts])];
    const [concepts, next] = await Promise.all([
      wanted.length > 0 ? this.state.conceptStates(userId, wanted) : Promise.resolve([]),
      this.state.nextConcept(userId),
    ]);
    return { message: 'Learner state', data: { userId, concepts, next } };
  }
}
