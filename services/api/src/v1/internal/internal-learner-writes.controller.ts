import { Body, Controller, Param, Patch, Post, Req, UseInterceptors } from '@nestjs/common';
import { InternalActing, InternalOwnership } from '@/common/authz/internal-acting.decorator';
import { resolveActingUserScope } from '@/common/authz/acting-scope';
import { RequireIdempotencyKey } from '@/common/idempotency/require-idempotency-key.decorator';
import { IdempotentWriteInterceptor } from '@/common/idempotency/idempotent-write.interceptor';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { ChatMessagesService } from '../chat/chat-messages/chat-messages.service';
import { UpdateChatMessageDto, UpdateChatMessageDtoType } from '../chat/chat-messages/chat-messages.dto';
import { ContentsService } from '../chat/contents/contents.service';
import { CreateContentDto, CreateContentDtoType } from '../chat/contents/contents.dto';
import { PersonalityQuizzesService } from '../learning/personality-quizzes/personality-quizzes.service';
import { CreatePersonalityQuizDto } from '../learning/personality-quizzes/personality-quizzes.dto';
import { ChatMessagesSseService } from '../sse/chat-messages-sse/chat-messages-sse.service';
import { ContentSseService } from '../sse/content-sse/content-sse.service';
import { PersonalityQuizSseService } from '../sse/personality-quiz-sse/personality-quiz-sse.service';

const InternalUpdateChatMessageDto = UpdateChatMessageDto.strict();
const InternalCreateContentDto = CreateContentDto.strict();
const InternalCreatePersonalityQuizDto = CreatePersonalityQuizDto.partial({ userId: true }).strict();

type InternalCreatePersonalityQuizType = ReturnType<typeof InternalCreatePersonalityQuizDto.parse>;

@Controller('internal')
@UseInterceptors(IdempotentWriteInterceptor)
export class InternalLearnerWritesController {
  constructor(
    private readonly chatMessagesService: ChatMessagesService,
    private readonly contentsService: ContentsService,
    private readonly personalityQuizzesService: PersonalityQuizzesService,
    private readonly chatMessagesSseService: ChatMessagesSseService,
    private readonly contentSseService: ContentSseService,
    private readonly personalityQuizSseService: PersonalityQuizSseService,
  ) {}

  @Patch('chat-messages/:id')
  @InternalActing()
  @InternalOwnership('message')
  @RequireIdempotencyKey()
  async updateChatMessage(
    @Param('id') id: string,
    @Body(new ZodPipe(InternalUpdateChatMessageDto)) body: UpdateChatMessageDtoType,
  ) {
    const res = await this.chatMessagesService.update(id, body);
    this.chatMessagesSseService.emitUpdate(res.data.chatId);
    return res;
  }

  @Post('contents')
  @InternalActing()
  @InternalOwnership('chat', { field: 'chatId', source: 'body' })
  @RequireIdempotencyKey()
  async createContent(@Body(new ZodPipe(InternalCreateContentDto)) body: CreateContentDtoType) {
    const res = await this.contentsService.create(body);
    this.contentSseService.emitUpdate(res.data.chatId);
    return res;
  }

  @Post('personality-quizzes')
  @InternalActing()
  @RequireIdempotencyKey()
  async createPersonalityQuiz(
    @Req() req: { user: { id: string } },
    @Body(new ZodPipe(InternalCreatePersonalityQuizDto)) body: InternalCreatePersonalityQuizType,
  ) {
    const userId = resolveActingUserScope(req.user.id, body.userId);
    const res = await this.personalityQuizzesService.create({ ...body, userId });
    this.personalityQuizSseService.emitUpdate({ userId, personalityQuizId: res.data.id });
    return res;
  }
}
