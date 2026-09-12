import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { SubtopicProgressesService } from './subtopic-progresses.service';
import { Query as QueryInterface } from '@/common/interfaces';
import { CreateSubTopicProgressType, UpdateSubTopicProgressType } from './subtopic-progresses.dto';

@Controller('subtopic-progresses')
export class SubtopicProgressesController {
  constructor(private readonly subtopicProgressesService: SubtopicProgressesService) {}

  @Post()
  create(@Body() createSubtopicProgressDto: CreateSubTopicProgressType) {
    return this.subtopicProgressesService.create(createSubtopicProgressDto);
  }

  @Get()
  findAll(
    @Query() q: QueryInterface
  ) {
    return this.subtopicProgressesService.findAll({
      ...q,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query() q: QueryInterface) {
    return this.subtopicProgressesService.findOne(id, q);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSubtopicProgressDto: UpdateSubTopicProgressType) {
    return this.subtopicProgressesService.update(id, updateSubtopicProgressDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.subtopicProgressesService.remove(id);
  }
}