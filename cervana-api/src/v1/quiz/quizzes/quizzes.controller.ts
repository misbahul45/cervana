import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { CreateQuizType, UpdateQuizType } from './Quizzes.dto';
import { Query as QueryInterface } from '@/common/interfaces';
@Controller('quizs')
export class QuizzesController {
  constructor(private readonly quizsService: QuizzesService) {}

  @Post()
  create(@Body() createQuizDto: CreateQuizType) {
    return this.quizsService.create(createQuizDto);
  }

  @Get()
  findAll(
    @Query() query:QueryInterface  
  ) {
    return this.quizsService.findAll(query);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query() query:QueryInterface
  ) {
    return this.quizsService.findOne(id, query);
  }

  @Get(':id/quiz-attempts')
  findAllQuizAttempts(
    @Param('id') id:string,
    @Query() query:QueryInterface
  ){
    return this.quizsService.findAllQuizAttempts(id, query)
  }

  @Get(':id/questions')
  findAllQuestions(
    @Param('id') id:string,
    @Query() query:QueryInterface
  ){
    return this.quizsService.findAllQuestions(id, query)
  }


  @Patch(':id')
  update(@Param('id') id: string, @Body() updateQuizDto:UpdateQuizType ) {
    return this.quizsService.update(id, updateQuizDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.quizsService.remove(id);
  }
}
