import { AuthenticatedOnly } from '@/common/authz/access';
import { Controller, Sse, MessageEvent, UseGuards, Req } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { ContentSseService } from './content-sse.service';
import { filterOwnedChat } from '../sse-filters';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { SseJwtGuard } from '@/v1/auth/guards/sse-jwt.guard';

@Controller('content-sse')
@UseGuards(SseJwtGuard)
export class ContentSseController {
  constructor(
    private readonly sseService: ContentSseService,
    private readonly prisma: PrismaService,
  ) {}

  @Sse()
  @AuthenticatedOnly()
  stream(@Req() req: any) {
    return this.sseService.events.pipe(
      filterOwnedChat(this.prisma, req.user.id),
      map((data) => ({
        data,
      })),
    );
  }
}
