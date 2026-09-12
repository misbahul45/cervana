import { Controller, Sse, MessageEvent, UseGuards } from '@nestjs/common';
import { map } from 'rxjs';
import { StreakSseService } from './streak-sse.service';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';

@Controller('streak-sse')
@UseGuards(SseJwtGuard)
export class StreakSseController {
  constructor(private readonly streakSseService: StreakSseService) {}

  @Sse()
  stream(): any {
    return this.streakSseService.events.pipe(
      map((event) => ({
        data: {
          userId: event.userId,
          newDate: event.newDate,
        },
      })),
    );
  }
}
