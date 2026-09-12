import { Controller, Sse, UseGuards } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { PersonalityQuizSseService } from './personality-quiz-sse.service';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';

@Controller('personality-quiz-sse')
@UseGuards(SseJwtGuard)
export class PersonalityQuizController {
  constructor(
    private readonly personalityQuizSseService: PersonalityQuizSseService,
  ) {}


  @Sse()
  stream() {
    return this.personalityQuizSseService.events$.pipe(
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
