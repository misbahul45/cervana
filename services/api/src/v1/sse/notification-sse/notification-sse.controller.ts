import { AuthenticatedOnly } from '@/common/authz/access';
import { Controller, Sse, MessageEvent, UseGuards, Req } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { NotificationSseService } from './notification-sse.service';
import { filterByUser } from '../sse-filters';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';

@Controller('notification-sse')
@UseGuards(SseJwtGuard)
export class NotificationSseController {
  constructor(private readonly sseService: NotificationSseService) {}

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
