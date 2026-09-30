import { ScopeToUser } from '@/common/authz/access';
import { RequireOwnership } from '@/v1/common/guards/ownership.decorator';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { SubtopicProgressesService } from './subtopic-progresses.service';
import { Query as QueryInterface } from '@/common/interfaces';
import { CreateSubTopicProgressType, UpdateSubTopicProgressType } from './subtopic-progresses.dto';

@Controller('subtopic-progresses')
export class SubtopicProgressesController {
  constructor(private readonly subtopicProgressesService: SubtopicProgressesService) {}

  @Post()
  @ScopeToUser()
  create(@Body() createSubtopicProgressDto: CreateSubTopicProgressType) {
    return this.subtopicProgressesService.create(createSubtopicProgressDto);
  }

  @Get()
  @ScopeToUser()
  findAll(
    @Query() q: QueryInterface
  ) {
    return this.subtopicProgressesService.findAll({
      ...q,
    });
  }

  @Get(':id')
  @RequireOwnership('subtopic-progress')
  findOne(@Param('id') id: string, @Query() q: QueryInterface) {
    return this.subtopicProgressesService.findOne(id, q);
  }

  @Patch(':id')
  @RequireOwnership('subtopic-progress')
  update(@Param('id') id: string, @Body() updateSubtopicProgressDto: UpdateSubTopicProgressType) {
    return this.subtopicProgressesService.update(id, updateSubtopicProgressDto);
  }

  @Delete(':id')
  @RequireOwnership('subtopic-progress')
  remove(@Param('id') id: string) {
    return this.subtopicProgressesService.remove(id);
  }
}