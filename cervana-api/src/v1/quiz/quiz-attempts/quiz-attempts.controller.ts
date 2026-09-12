import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { QuizAttemptsService } from './quiz-attempts.service';
import { CreateQuizAttemptType, UpdateQuizAttemptType } from './quizAttempets.dto';
import { Query as QueryInterface } from '@/common/interfaces';


@Controller('quiz-attempts')
export class QuizAttemptsController {
  constructor(private readonly quizAttemptsService: QuizAttemptsService) {}

  @Post()
  create(@Body() createQuizAttemptDto: CreateQuizAttemptType) {
    return this.quizAttemptsService.create(createQuizAttemptDto);
  }

  @Get(':id/answers')
  findAllAnswer(
    @Param('id') id:string,
    @Query() query:QueryInterface
  ){
    return this.quizAttemptsService.findAllAnswer(id, query)
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query() query:QueryInterface
  ) {
    return this.quizAttemptsService.findOne(id, query);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateQuizAttemptDto: UpdateQuizAttemptType) {
    return this.quizAttemptsService.update(id, updateQuizAttemptDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.quizAttemptsService.remove(id);
  }
}
