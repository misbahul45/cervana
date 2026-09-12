import { Controller, Sse, MessageEvent, UseGuards } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { ContentSseService } from './content-sse.service';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';

@Controller('content-sse')
@UseGuards(SseJwtGuard)
export class ContentSseController {
  constructor(private readonly sseService: ContentSseService) {}

  @Sse()
  stream(): Observable<MessageEvent> {
    return this.sseService.events.pipe(
      map((data) => ({
        data,
      })),
    );
  }
}
