import { RequireOwnership, RequireParentOwnership } from '@/v1/common/guards/ownership.decorator';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ExperiencesService } from './experiences.service';
import { Query as ExperiencesQuery } from '@/common/interfaces';

@Controller('experiences')
export class ExperiencesController {
  constructor(private readonly experiencesService: ExperiencesService) {}

  @Post()
  @RequireParentOwnership('teacher-application', 'teacherApplicationId')
  create(@Body() createExperienceDto: any) {
    return this.experiencesService.create(createExperienceDto);
  }

  @Get()
  @RequireParentOwnership('teacher-application', 'teacherApplicationId', 'query')
  findAll(
    @Query() q:ExperiencesQuery
  ) {
    return this.experiencesService.findAll(q);
  }

  @Get(':id')
  @RequireOwnership('teacher-experience')
  findOne(@Param('id') id: string) {
    return this.experiencesService.findOne(id);
  }

  @Patch(':id')
  @RequireOwnership('teacher-experience')
  update(@Param('id') id: string, @Body() updateExperienceDto: any) {
    return this.experiencesService.update(id, updateExperienceDto);
  }

  @Delete(':id')
  @RequireOwnership('teacher-experience')
  remove(@Param('id') id: string) {
    return this.experiencesService.remove(id);
  }
}
