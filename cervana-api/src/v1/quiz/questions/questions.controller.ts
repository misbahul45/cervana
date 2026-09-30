import { RequireOwnership } from '@/v1/common/guards/ownership.decorator';
import { Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
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
  @Roles(Role.ADMIN, Role.TEACHER)
  create(@Body() createQuestionDto: CreateQuestionType) {
    return this.questionsService.create(createQuestionDto);
  }

  @Get(':id')
  @ApiCrudDocs.findOne(QuestionDetailSchema, 'Question')
  @RequireOwnership('question')
  findOne(
    @Param('id') id: string,
    @Query() query:QueryInterface
  ) {
    return this.questionsService.findOne(id, query);
  }

  @Patch(':id')
  @ApiCrudDocs.update(UpdateQuestionDto, 'Question')
  @Roles(Role.ADMIN, Role.TEACHER)
  update(@Param('id') id: string, @Body() updateQuestionDto: UpdateQuestionType) {
    return this.questionsService.update(id, updateQuestionDto);
  }

  @Delete(':id')
  @ApiCrudDocs.delete('Question')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.questionsService.remove(id);
  }
}
