import { Body, Controller, Post, Req } from '@nestjs/common';
import { AuthenticatedOnly } from '@/common/authz/access';
import { TutorService, type TutorMessageInput } from './tutor.service';
import { z } from 'zod';
import { ZodPipe } from '@/common/pipes/zod.pipe';

const TutorMessageDto = z.object({
  text: z.string().min(1),
  domain: z.string().min(1),
  topicId: z.string().optional(),
  recentTopic: z.string().optional(),
  conceptKey: z.string().optional(),
  sessionId: z.string().optional(),
});

type Authed = { user: { id: string; role: string } };

@Controller('tutor')
@AuthenticatedOnly()
export class TutorController {
  constructor(private readonly tutor: TutorService) {}

  @Post('message')
  async message(
    @Body(new ZodPipe(TutorMessageDto)) body: z.infer<typeof TutorMessageDto>,
    @Req() req: Authed,
  ) {
    const input: TutorMessageInput = {
      userId: req.user.id,
      text: body.text,
      domain: body.domain,
      topicId: body.topicId,
      recentTopic: body.recentTopic,
      conceptKey: body.conceptKey,
      sessionId: body.sessionId,
    };
    return this.tutor.respond(input);
  }
}
