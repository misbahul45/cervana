import { Controller, Get } from '@nestjs/common';
import { AuthenticatedOnly } from '@/common/authz/access';
import { GetUser } from '@/v1/auth/auth.decorator';
import { LearnerStateService } from './learner-state.service';

@Controller('learner-model')
export class LearnerModelController {
  constructor(private readonly state: LearnerStateService) {}

  @Get('me/mastery')
  @AuthenticatedOnly()
  async mastery(@GetUser('id') userId: string) {
    return { message: 'Concept mastery', data: await this.state.listMastery(userId) };
  }

  @Get('me/next')
  @AuthenticatedOnly()
  async next(@GetUser('id') userId: string) {
    return { message: 'Next concept', data: await this.state.nextConcept(userId) };
  }

  @Get('me/skill-nodes')
  @AuthenticatedOnly()
  async skillNodes(@GetUser('id') userId: string) {
    return { message: 'Skill nodes', data: await this.state.skillNodes(userId) };
  }
}
