import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto, CreateQuestionType, UpdateQuestionDto, UpdateQuestionType } from './questions.dto';
import { Query as QueryInterface } from '@/common/interfaces';
import { ApiCrudDocs } from '@/common/lib/docs';
import { BaseQuestionSchema, QuestionDetailSchema } from '@/common/docs/question.doc';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  @ApiCrudDocs.create(BaseQuestionSchema, CreateQuestionDto, 'Question')
  create(@Body() createQuestionDto: CreateQuestionType) {
    return this.questionsService.create(createQuestionDto);
  }

  @Get(':id')
  @ApiCrudDocs.findOne(QuestionDetailSchema, 'Question')
  findOne(
    @Param('id') id: string,
    @Query() query:QueryInterface
  ) {
    return this.questionsService.findOne(id, query);
  }

  @Patch(':id')
  @ApiCrudDocs.update(UpdateQuestionDto, 'Question')
  update(@Param('id') id: string, @Body() updateQuestionDto: UpdateQuestionType) {
    return this.questionsService.update(id, updateQuestionDto);
  }

  @Delete(':id')
  @ApiCrudDocs.delete('Question')
  remove(@Param('id') id: string) {
    return this.questionsService.remove(id);
  }
}
