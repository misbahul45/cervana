import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { StepsService } from './steps.service';
import { CreateStepDto, CreateStepType, UpdateStepDto, UpdateStepType } from './steps.dto';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { ApiTags } from '@nestjs/swagger';
import { ApiCrudDocs } from '@/common/lib/docs';
import { BaseStepSchema, StepDetailSchema, StepsListSchema } from '@/common/docs/step.doc';
import { Query as QueryInterface } from '@/common/interfaces';
import { ContentListSchema } from '@/common/docs/content.doc';
import { GetUser } from '@/v1/auth/auth.decorator';
import { StepProgressListSchema } from '@/common/docs/stepProgress.doc';
import { User } from '@prisma/client';

@ApiTags('Step')
@Controller('steps')
export class StepsController {
  constructor(private readonly stepsService: StepsService) { }

  @Post()
  @ApiCrudDocs.create(BaseStepSchema, CreateStepDto, 'Step')
  create(
    @GetUser() user: User,
    @Body(new ZodPipe(CreateStepDto)) createStepDto: CreateStepType
  ) {
    return this.stepsService.create(user.id, createStepDto);
  }

  @Get(':id')
  @ApiCrudDocs.findOne(StepDetailSchema, "Step")
  findOne(
    @Param('id') id: string,
    @Query() query: QueryInterface  
  ) {
    return this.stepsService.findOne(id, query);
  }

  @Patch(':id')
  @ApiCrudDocs.update(UpdateStepDto, 'Step')
  update(@Param('id') id: string, @Body(new ZodPipe(UpdateStepDto)) updateStepDto: UpdateStepType) {
    return this.stepsService.update(id, updateStepDto);
  }

  @Delete(':id')
  @ApiCrudDocs.delete('Step')
  remove(@Param('id') id: string) {
    return this.stepsService.remove(id);
  }

  @Get('')
  @ApiCrudDocs.findAll(StepsListSchema, "Steps", true)
  findAllSubTopics(
      @Query() query: QueryInterface
  ){
    return this.stepsService.findAll(query)
  }
  
}
