import { RequireOwnership, RequireParentOwnership } from '@/v1/common/guards/ownership.decorator';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { LearningStylesService } from './learning-styles.service';
import { Query as LearningStyleQuery } from '@/common/interfaces';
import { CreateLearningStyleProfileType, UpdateLearningStyleProfileType } from './learning-styles.dto';

@Controller('learning-styles')
export class LearningStylesController {
  constructor(private readonly learningStylesService: LearningStylesService) {}

  @Post()
  @RequireParentOwnership('user-topic', 'userTopicId')
  create(@Body() createLearningStyleDto: CreateLearningStyleProfileType) {
    return this.learningStylesService.create(createLearningStyleDto);
  }

  @Get(':id')
  @RequireOwnership('learning-style')
  findOne(
    @Param('id') id: string,
    @Query() q:LearningStyleQuery
  ) {
    return this.learningStylesService.findOne(id, q);
  }

  @Patch(':id')
  @RequireOwnership('learning-style')
  update(@Param('id') id: string, @Body() updateLearningStyleDto: UpdateLearningStyleProfileType) {
    return this.learningStylesService.update(id, updateLearningStyleDto);
  }

  @Delete(':id')
  @RequireOwnership('learning-style')
  remove(@Param('id') id: string) {
    return this.learningStylesService.remove(id);
  }
}
