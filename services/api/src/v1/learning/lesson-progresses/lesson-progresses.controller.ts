import { ScopeToUser } from '@/common/authz/access';
import { RequireOwnership } from '@/v1/common/guards/ownership.decorator';
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
  @ScopeToUser()
  create(@Body() createLessonProgressDto: CreateLessonProgressType) {
    return this.lessonProgressesService.create(createLessonProgressDto);
  }

  @Get()
  @ScopeToUser()
  findAll(
    @GetUser() user:User,
    @Query() query:QueryInterface
  ) {
    return this.lessonProgressesService.findAll(user.id, query);
  }

  @Get(':id')
  @RequireOwnership('lesson-progress')
  findOne(
    @Param('id') id: string,
    @Query() query:QueryInterface
) {
    return this.lessonProgressesService.findOne(id, query);
  }

  @Patch(':id')
  @RequireOwnership('lesson-progress')
  update(@Param('id') id: string, @Body() updateLessonProgressDto: UpdateLessonProgressType) {
    return this.lessonProgressesService.update(id, updateLessonProgressDto);
  }

  @Delete(':id')
  @RequireOwnership('lesson-progress')
  remove(@Param('id') id: string) {
    return this.lessonProgressesService.remove(id);
  }
}
