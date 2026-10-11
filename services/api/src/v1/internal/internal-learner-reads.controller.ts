import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { InternalActing, InternalOwnership } from '@/common/authz/internal-acting.decorator';
import { resolveActingUserScope } from '@/common/authz/acting-scope';
import { Query as QueryInterface } from '@/common/interfaces';
import { UserStepsService } from '../learning/user-steps/user-steps.service';
import { LearningStylesService } from '../learning/learning-styles/learning-styles.service';
import { PersonalityQuizzesService } from '../learning/personality-quizzes/personality-quizzes.service';
import { ContentSimilarityService } from '../chat/contents/content-similarity.service';

@Controller('internal')
export class InternalLearnerReadsController {
  constructor(
    private readonly userStepsService: UserStepsService,
    private readonly learningStylesService: LearningStylesService,
    private readonly personalityQuizzesService: PersonalityQuizzesService,
    private readonly contentSimilarityService: ContentSimilarityService,
  ) {}

  @Get('user-steps/:id')
  @InternalActing()
  @InternalOwnership('user-step')
  findUserStep(@Param('id') id: string, @Query() query: QueryInterface) {
    return this.userStepsService.findOne(id, query);
  }

  @Get('learning-styles/:id')
  @InternalActing()
  @InternalOwnership('learning-style')
  findLearningStyle(@Param('id') id: string, @Query() query: QueryInterface) {
    return this.learningStylesService.findOne(id, query);
  }

  @Get('personality-quizzes')
  @InternalActing()
  findPersonalityQuizzes(@Req() req: { user: { id: string } }, @Query() query: QueryInterface) {
    const userId = resolveActingUserScope(req.user.id, query.userId);
    return this.personalityQuizzesService.findAll(userId, query);
  }

  @Get('contents/similarity')
  @InternalActing()
  @InternalOwnership('chat', { field: 'chatId', source: 'query' })
  findSimilarContents(@Query('chatId') chatId: string, @Query('query') query: string) {
    return this.contentSimilarityService.findSimilar(chatId, query);
  }
}
