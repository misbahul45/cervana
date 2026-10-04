import { Role } from '@prisma/client';
import { ScopeToUser } from '@/common/authz/access';
import { RequireOwnership } from '@/v1/common/guards/ownership.decorator';
import { Controller, Get, Body, Param, Delete, Post, Query, UseInterceptors } from '@nestjs/common';
import { QuizAttemptsService } from './quiz-attempts.service';
import {
  CreateQuizAttemptType,
  StartQuizAttemptDto,
  StartQuizAttemptDtoType,
  SubmitQuizAttemptDto,
  SubmitQuizAttemptDtoType,
} from './quizAttempets.dto';
import { Query as QueryInterface } from '@/common/interfaces';
import { ActivityDetectorInterceptor } from '@/common/interceptors/daily-activity.interceptor';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';


@Controller('quiz-attempts')
export class QuizAttemptsController {
  constructor(private readonly quizAttemptsService: QuizAttemptsService) {}

  @Post()
  @ScopeToUser()
  @UseInterceptors(ActivityDetectorInterceptor)
  create(@Body() createQuizAttemptDto: CreateQuizAttemptType) {
    return this.quizAttemptsService.create(createQuizAttemptDto);
  }

  @Post('start')
  @ScopeToUser()
  start(
    @Body(new ZodPipe(StartQuizAttemptDto)) dto: StartQuizAttemptDtoType,
    @GetUser() user: AuthUser,
  ) {
    return this.quizAttemptsService.startAttempt({ id: user.id, role: user.role }, dto);
  }

  @Post(':id/submit')
  @RequireOwnership('quiz-attempt')
  submit(
    @Param('id') id: string,
    @Body(new ZodPipe(SubmitQuizAttemptDto)) dto: SubmitQuizAttemptDtoType,
    @GetUser() user: AuthUser,
  ) {
    return this.quizAttemptsService.submitAttempt({
      userId: user.id,
      attemptId: id,
      answers: dto.answers,
      hintUsed: dto.hintUsed,
    });
  }


  @Get(':id/answers')
  @RequireOwnership('quiz-attempt')
  findAllAnswer(
    @Param('id') id: string,
    @Query() query: QueryInterface,
  ) {
    return this.quizAttemptsService.findAllAnswer(id, query);
  }

  @Get(':id')
  @RequireOwnership('quiz-attempt')
  findOne(
    @Param('id') id: string,
    @Query() query: QueryInterface,
  ) {
    return this.quizAttemptsService.findOne(id, query);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @RequireOwnership('quiz-attempt')
  remove(@Param('id') id: string) {
    return this.quizAttemptsService.remove(id);
  }
}
