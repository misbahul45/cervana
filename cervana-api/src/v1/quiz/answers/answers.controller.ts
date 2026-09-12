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
  create(@Body() createAnswerDto: CreateAnswerType) {
    return this.answersService.create(createAnswerDto);
  }

  @Get(':id')
  @ApiCrudDocs.findOne(BaseAnswerSchema, 'Answer')
  findOne(@Param('id') id: string) {
    return this.answersService.findOne(id);
  }

  @Patch(':id')
  @ApiCrudDocs.update(UpdateAnswerDto, 'Answer')
  update(@Param('id') id: string, @Body() updateAnswerDto: UpdateAnswerType) {
    return this.answersService.update(id, updateAnswerDto);
  }

  @Delete(':id')
  @ApiCrudDocs.delete('Answer')
  remove(@Param('id') id: string) {
    return this.answersService.remove(id);
  }
}
