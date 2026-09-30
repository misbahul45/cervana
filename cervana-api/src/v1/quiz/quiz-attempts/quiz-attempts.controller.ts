import { ScopeToUser } from '@/common/authz/access';
import { RequireOwnership } from '@/v1/common/guards/ownership.decorator';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { QuizAttemptsService } from './quiz-attempts.service';
import { CreateQuizAttemptType, UpdateQuizAttemptType } from './quizAttempets.dto';
import { Query as QueryInterface } from '@/common/interfaces';


@Controller('quiz-attempts')
export class QuizAttemptsController {
  constructor(private readonly quizAttemptsService: QuizAttemptsService) {}

  @Post()
  @ScopeToUser()
  create(@Body() createQuizAttemptDto: CreateQuizAttemptType) {
    return this.quizAttemptsService.create(createQuizAttemptDto);
  }

  @Get(':id/answers')
  @RequireOwnership('quiz-attempt')
  findAllAnswer(
    @Param('id') id:string,
    @Query() query:QueryInterface
  ){
    return this.quizAttemptsService.findAllAnswer(id, query)
  }

  @Get(':id')
  @RequireOwnership('quiz-attempt')
  findOne(
    @Param('id') id: string,
    @Query() query:QueryInterface
  ) {
    return this.quizAttemptsService.findOne(id, query);
  }

  @Patch(':id')
  @RequireOwnership('quiz-attempt')
  update(@Param('id') id: string, @Body() updateQuizAttemptDto: UpdateQuizAttemptType) {
    return this.quizAttemptsService.update(id, updateQuizAttemptDto);
  }

  @Delete(':id')
  @RequireOwnership('quiz-attempt')
  remove(@Param('id') id: string) {
    return this.quizAttemptsService.remove(id);
  }
}
