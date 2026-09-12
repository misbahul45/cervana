import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { Query as ApplicationsQuery } from '@/common/interfaces';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  create(@Body() createApplicationDto: any) {
    return this.applicationsService.create(createApplicationDto);
  }

  @Get()
  findAll(
    @Query() q:ApplicationsQuery
  ) {
    return this.applicationsService.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.applicationsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateApplicationDto:any) {
    return this.applicationsService.update(id, updateApplicationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.applicationsService.remove(id);
  }
}
