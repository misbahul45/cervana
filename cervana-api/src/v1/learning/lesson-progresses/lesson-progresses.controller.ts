import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { LessonProgressesService } from './lesson-progresses.service';
import { UpdateLessonProgressType, CreateLessonProgressType } from './lesson-progresses.dto'
import { GetUser } from '@/v1/auth/auth.decorator';
import { Query as QueryInterface } from '@/common/interfaces';
import { User } from '@prisma/client';

@Controller('lesson-progresses')
export class LessonProgressesController {
  constructor(private readonly lessonProgressesService: LessonProgressesService) {}

  @Post()
  create(@Body() createLessonProgressDto: CreateLessonProgressType) {
    return this.lessonProgressesService.create(createLessonProgressDto);
  }

  @Get()
  findAll(
    @GetUser() user:User,
    @Query() query:QueryInterface
  ) {
    return this.lessonProgressesService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query() query:QueryInterface
) {
    return this.lessonProgressesService.findOne(id, query);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLessonProgressDto: UpdateLessonProgressType) {
    return this.lessonProgressesService.update(id, updateLessonProgressDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lessonProgressesService.remove(id);
  }
}
