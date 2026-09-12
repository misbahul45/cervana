import { Controller, Sse, UseGuards } from '@nestjs/common';
import { UserStepsSseService } from './user-steps-sse.service';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';
import { map } from 'rxjs/operators';

@Controller('user-steps-sse')
@UseGuards(SseJwtGuard)
export class UserStepsSseController {
  constructor(private readonly userStepsSseService: UserStepsSseService) {}

  @Sse()
  stream() {
    return this.userStepsSseService.events.pipe(
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
