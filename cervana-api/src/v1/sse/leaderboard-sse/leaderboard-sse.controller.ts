import { AuthenticatedOnly } from '@/common/authz/access';
import { Controller, Sse, MessageEvent, UseGuards, Req } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { LeaderboardSseService } from './leaderboard-sse.service';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';

@Controller('leaderboard-sse')
@UseGuards(SseJwtGuard)
export class LeaderboardSseController {
  constructor(private readonly sseService: LeaderboardSseService) {}

  @Sse('stream')
  @AuthenticatedOnly()
  stream(@Req() req: any) {
    return this.sseService.events.pipe(
      map(({ userId: _omitted, ...data }: any) => ({
        data,
      })),
    );
  }
}
