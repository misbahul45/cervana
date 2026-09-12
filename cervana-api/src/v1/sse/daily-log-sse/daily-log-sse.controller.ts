import { Controller, Sse, MessageEvent, UseGuards } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { DailyLogSseService } from './daily-log-sse.service';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';

@Controller('daily-log-sse')
@UseGuards(SseJwtGuard)
export class DailyLogSseController {
  constructor(private readonly sseService: DailyLogSseService) {}

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.sseService.events.pipe(
      map((data) => ({
        data,
      })),
    );
  }
}
