import { Controller, Sse, MessageEvent, UseGuards } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { LeaderboardSseService } from './leaderboard-sse.service';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';

@Controller('leaderboard-sse')
@UseGuards(SseJwtGuard)
export class LeaderboardSseController {
  constructor(private readonly sseService: LeaderboardSseService) {}

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.sseService.events.pipe(
      map((data) => ({
        data,
      })),
    );
  }
}
