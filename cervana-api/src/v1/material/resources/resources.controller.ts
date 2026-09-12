import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { CreateResourceType } from './resources.dto';
import { Query as QueryResource } from '@/common/interfaces';
import { Roles } from '@/v1/auth/auth.decorator';
import { JOBSTATUSTYPE, Role } from '@prisma/client';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Roles(Role.TEACHER)
  @Post()
  create(@Body() createResourceDto: CreateResourceType, @Req() req) {
    const token =
    req.cookies?.access_token ||
    req.headers.authorization?.replace('Bearer ', '');
    return this.resourcesService.create(createResourceDto, token);
  }

  @Roles(Role.TEACHER)
  @Get()
  findAll(@Query() query: QueryResource) {
    return this.resourcesService.findAll(query);
  }

  @Roles(Role.TEACHER)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resourcesService.findOne(id);
  }

  @Roles(Role.TEACHER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.resourcesService.remove(id);
  }

  @Post("callback")
  callback(
    @Req() req,
    @Body() body: { resourceId: string; content?: string; status?:JOBSTATUSTYPE },
    @Query('type') type:'EMMBED' | 'EXTRACT'
  ) { 
    const token =
    req.cookies?.access_token ||
    req.headers.authorization?.replace('Bearer ', '');


    console.log(body)
    return this.resourcesService.callback(token, type, body);
  }
}
