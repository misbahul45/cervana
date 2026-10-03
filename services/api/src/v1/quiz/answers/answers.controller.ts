import { Role } from '@prisma/client';
import { RequireOwnership, RequireParentOwnership } from '@/v1/common/guards/ownership.decorator';
import { Controller, Get, Post, Param, Delete, Body } from '@nestjs/common';
import { AnswersService } from './answers.service';
import { CreateAnswerDto, CreateAnswerType } from './answers.dto';
import { ApiCrudDocs } from '@/common/lib/docs';
import { BaseAnswerSchema } from '@/common/docs/answer.doc';
import { Roles } from '@/v1/auth/auth.decorator';

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

  @Delete(':id')
  @ApiCrudDocs.delete('Answer')
  @Roles(Role.ADMIN)
  @RequireOwnership('answer')
  remove(@Param('id') id: string) {
    return this.answersService.remove(id);
  }
}
