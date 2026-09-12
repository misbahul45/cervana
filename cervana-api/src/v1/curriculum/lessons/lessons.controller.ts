import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto, CreateLessonType, UpdateLessonDto, UpdateLessonType } from './lessons.dto';
import { Query as QueryInterface } from '@/common/interfaces';
import { ApiTags } from '@nestjs/swagger';
import { ApiCrudDocs } from '@/common/lib/docs';
import { BaseLessonSchema, LessonDetailSchema } from '@/common/docs/lesson.doc';
import { StepsListSchema } from '@/common/docs/step.doc';


@ApiTags('Lessons')
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post()
  @ApiCrudDocs.create(BaseLessonSchema, CreateLessonDto, 'Lesson')
  create(@Body() createLessonDto: CreateLessonType) {
    return this.lessonsService.create(createLessonDto);
  }

  @Get(':id')
  @ApiCrudDocs.findOne(LessonDetailSchema, "Lesson")
  findOne(
    @Param('id') id: string,
    @Query() query: QueryInterface  
  ) {
    return this.lessonsService.findOne(id, query);
  }

  @Patch(':id')
  @ApiCrudDocs.update(UpdateLessonDto, 'Lesson')
  update(@Param('id') id: string, @Body() updateLessonDto: UpdateLessonType) {
    return this.lessonsService.update(id, updateLessonDto);
  }

  @Delete(':id')
  @ApiCrudDocs.delete('Lesson')
  remove(@Param('id') id: string) {
    return this.lessonsService.remove(id);
  }
}
