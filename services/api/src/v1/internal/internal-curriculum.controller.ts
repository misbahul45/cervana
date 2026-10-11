import { Controller, Get, Param, Query } from '@nestjs/common';
import { InternalOnly } from '@/common/authz/internal-service.guard';
import { Query as QueryInterface } from '@/common/interfaces';
import { LessonsService } from '../curriculum/lessons/lessons.service';
import { StepsService } from '../curriculum/steps/steps.service';

@Controller('internal')
export class InternalCurriculumController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly stepsService: StepsService,
  ) {}

  @Get('lessons/:id')
  @InternalOnly()
  findLesson(@Param('id') id: string, @Query() query: QueryInterface) {
    return this.lessonsService.findOne(id, query);
  }

  @Get('steps')
  @InternalOnly()
  findSteps(@Query() query: QueryInterface) {
    return this.stepsService.findAll(query);
  }

  @Get('steps/:id')
  @InternalOnly()
  findStep(@Param('id') id: string, @Query() query: QueryInterface) {
    return this.stepsService.findOne(id, query);
  }
}
