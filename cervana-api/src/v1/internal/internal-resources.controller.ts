import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { InternalOnly } from '@/common/authz/internal-service.guard';
import { ResourcesService } from '../material/resources/resources.service';
import {
  InternalResourceCallbackDto,
  InternalResourceCallbackQueryDto,
  InternalResourceCallbackQueryType,
  InternalResourceCallbackType,
} from '../material/resources/resources.dto';

@Controller('internal/resources')
export class InternalResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @InternalOnly()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resourcesService.findOne(id);
  }

  @InternalOnly()
  @Post('callback')
  callback(
    @Body(new ZodPipe(InternalResourceCallbackDto)) body: InternalResourceCallbackType,
    @Query(new ZodPipe(InternalResourceCallbackQueryDto)) query: InternalResourceCallbackQueryType,
  ) {
    return this.resourcesService.callback(query.type, body);
  }
}
