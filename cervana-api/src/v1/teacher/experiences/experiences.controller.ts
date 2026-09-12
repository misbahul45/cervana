import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ExperiencesService } from './experiences.service';
import { Query as ExperiencesQuery } from '@/common/interfaces';

@Controller('experiences')
export class ExperiencesController {
  constructor(private readonly experiencesService: ExperiencesService) {}

  @Post()
  create(@Body() createExperienceDto: any) {
    return this.experiencesService.create(createExperienceDto);
  }

  @Get()
  findAll(
    @Query() q:ExperiencesQuery
  ) {
    return this.experiencesService.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.experiencesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateExperienceDto: any) {
    return this.experiencesService.update(id, updateExperienceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.experiencesService.remove(id);
  }
}
