import { Controller, Sse, MessageEvent, UseGuards } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { NotificationSseService } from './notification-sse.service';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';

@Controller('notification-sse')
@UseGuards(SseJwtGuard)
export class NotificationSseController {
  constructor(private readonly sseService: NotificationSseService) {}

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.sseService.events.pipe(
      map((data) => ({
        data,
      })),
    );
  }
}
