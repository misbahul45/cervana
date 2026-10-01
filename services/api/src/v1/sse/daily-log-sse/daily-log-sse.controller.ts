import { AuthenticatedOnly } from '@/common/authz/access';
import { Controller, Sse, MessageEvent, UseGuards, Req } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { DailyLogSseService } from './daily-log-sse.service';
import { filterByUser } from '../sse-filters';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';

@Controller('daily-log-sse')
@UseGuards(SseJwtGuard)
export class DailyLogSseController {
  constructor(private readonly sseService: DailyLogSseService) {}

  @Sse('stream')
  @AuthenticatedOnly()
  stream(@Req() req: any) {
    return this.sseService.events.pipe(
      filterByUser(req.user.id),
      map((data) => ({
        data,
      })),
    );
  }
}
