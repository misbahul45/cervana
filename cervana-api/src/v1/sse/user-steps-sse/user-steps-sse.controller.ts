import { AuthenticatedOnly } from '@/common/authz/access';
import { Controller, Sse, UseGuards, Req } from '@nestjs/common';
import { UserStepsSseService } from './user-steps-sse.service';
import { filterByUser } from '../sse-filters';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';
import { map } from 'rxjs/operators';

@Controller('user-steps-sse')
@UseGuards(SseJwtGuard)
export class UserStepsSseController {
  constructor(private readonly userStepsSseService: UserStepsSseService) {}

  @Sse()
  @AuthenticatedOnly()
  stream(@Req() req: any) {
    return this.userStepsSseService.events.pipe(
      filterByUser(req.user.id),
      map(event => ({
        data: {
          userId: event.userId,
          stepId: event.stepId,
          newDate: event.newDate,
          isDone: event.isDone
        },
      }))
    );
  }
}
