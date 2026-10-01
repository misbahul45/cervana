import { ScopeToUser } from '@/common/authz/access';
import { RequireOwnership } from '@/v1/common/guards/ownership.decorator';
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
  @ScopeToUser()
  create(@Body() createDto: CreateStepProgressType) {
    return this.stepProgressesService.create(createDto);
  }

  @Get()
  @ScopeToUser()
  findAll(@Query() q: QueryInterface) {
    return this.stepProgressesService.findAll({
      ...q,
    });
  }

  @Get(':id')
  @RequireOwnership('step-progress')
  findOne(@Param('id') id: string, @Query() q: QueryInterface) {
    return this.stepProgressesService.findOne(id, q);
  }

  @Patch(':id')
  @RequireOwnership('step-progress')
  update(@Param('id') id: string, @Body() updateDto: UpdateStepProgressType) {
    return this.stepProgressesService.update(id, updateDto);
  }

  @Delete(':id')
  @RequireOwnership('step-progress')
  remove(@Param('id') id: string) {
    return this.stepProgressesService.remove(id);
  }
}
