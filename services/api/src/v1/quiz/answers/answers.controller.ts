import { RequireOwnership, RequireParentOwnership } from '@/v1/common/guards/ownership.decorator';
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AnswersService } from './answers.service';
import { CreateAnswerDto, CreateAnswerType, UpdateAnswerDto, UpdateAnswerType } from './answers.dto';
import { ApiCrudDocs } from '@/common/lib/docs';
import { BaseAnswerSchema } from '@/common/docs/answer.doc';

@Controller('answers')
export class AnswersController {
  constructor(private readonly answersService: AnswersService) {}

  @Post()
  @ApiCrudDocs.create(BaseAnswerSchema, CreateAnswerDto, 'Answer')
  @RequireParentOwnership('quiz-attempt', 'attemptId')
  create(@Body() createAnswerDto: CreateAnswerType) {
    return this.answersService.create(createAnswerDto);
  }

  @Get(':id')
  @ApiCrudDocs.findOne(BaseAnswerSchema, 'Answer')
  @RequireOwnership('answer')
  findOne(@Param('id') id: string) {
    return this.answersService.findOne(id);
  }

  @Patch(':id')
  @ApiCrudDocs.update(UpdateAnswerDto, 'Answer')
  @RequireOwnership('answer')
  update(@Param('id') id: string, @Body() updateAnswerDto: UpdateAnswerType) {
    return this.answersService.update(id, updateAnswerDto);
  }

  @Delete(':id')
  @ApiCrudDocs.delete('Answer')
  @RequireOwnership('answer')
  remove(@Param('id') id: string) {
    return this.answersService.remove(id);
  }
}
