import { AuthenticatedOnly } from '@/common/authz/access';
import { Controller, Sse, MessageEvent, UseGuards, Req } from '@nestjs/common';
import { map } from 'rxjs';
import { StreakSseService } from './streak-sse.service';
import { filterByUser } from '../sse-filters';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';

@Controller('streak-sse')
@UseGuards(SseJwtGuard)
export class StreakSseController {
  constructor(private readonly streakSseService: StreakSseService) {}

  @Sse()
  @AuthenticatedOnly()
  stream(@Req() req: any) {
    return this.streakSseService.events.pipe(
      filterByUser(req.user.id),
      map((event) => ({
        data: {
          userId: event.userId,
          newDate: event.newDate,
        },
      })),
    );
  }
}
