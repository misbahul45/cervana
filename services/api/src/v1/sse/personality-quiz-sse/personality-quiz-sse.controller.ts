import { AuthenticatedOnly } from '@/common/authz/access';
import { Controller, Sse, UseGuards, Req } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { PersonalityQuizSseService } from './personality-quiz-sse.service';
import { filterByUser } from '../sse-filters';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';

@Controller('personality-quiz-sse')
@UseGuards(SseJwtGuard)
export class PersonalityQuizController {
  constructor(
    private readonly personalityQuizSseService: PersonalityQuizSseService,
  ) {}


  @Sse()
  @AuthenticatedOnly()
  stream(@Req() req: any) {
    return this.personalityQuizSseService.events$.pipe(
      filterByUser(req.user.id),
      map(event => ({
        data: {
          userId: event.userId,
          personalityQuizId: event.personalityQuizId,
          newDate: event.newDate,
        },
      }))
    );
  }

}
