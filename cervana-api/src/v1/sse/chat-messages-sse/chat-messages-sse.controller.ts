import { Controller, Sse, MessageEvent, UseGuards } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { ChatMessagesSseService } from './chat-messages-sse.service';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';

@Controller('chat-message-sse')
@UseGuards(SseJwtGuard)
export class ChatMessagesSseController {
  constructor(private readonly sseService: ChatMessagesSseService) {}

  @Sse('')
  stream(): Observable<MessageEvent> {
    return this.sseService.events.pipe(
      map((data) => ({
        data,
      })),
    );
  }
}
