import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { CreateResourceType } from './resources.dto';
import { Query as QueryResource } from '@/common/interfaces';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { JOBSTATUSTYPE, Role, User } from '@prisma/client';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Roles(Role.TEACHER)
  @Post()
  create(@Body() createResourceDto: CreateResourceType, @GetUser() user: User) {
    return this.resourcesService.create(createResourceDto, user.id);
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
}
