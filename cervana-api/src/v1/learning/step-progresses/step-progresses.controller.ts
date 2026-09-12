import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { StepProgressesService } from './step-progresses.service';
import { Query as QueryInterface } from '@/common/interfaces';
import {
  CreateStepProgressType,
  UpdateStepProgressType,
} from './step-progresses.dto';

@Controller('step-progresses')
export class StepProgressesController {
  constructor(private readonly stepProgressesService: StepProgressesService) {}

  @Post()
  create(@Body() createDto: CreateStepProgressType) {
    return this.stepProgressesService.create(createDto);
  }

  @Get()
  findAll(@Query() q: QueryInterface) {
    return this.stepProgressesService.findAll({
      ...q,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query() q: QueryInterface) {
    return this.stepProgressesService.findOne(id, q);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateStepProgressType) {
    return this.stepProgressesService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stepProgressesService.remove(id);
  }
}
