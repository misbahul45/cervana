import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UserTopicsService } from './user-topics.service';
import { CreateUserTopicType, UpdateUserTopicType } from './userTopics.dto';
import { GetUser } from '@/v1/auth/auth.decorator';
import { Query as QueryInterface } from '@/common/interfaces';
import { User } from '@prisma/client';

@Controller('user-topics')
export class UserTopicsController {
  constructor(private readonly userTopicsService: UserTopicsService) {}

  @Post()
  create(@Body() createUserTopicDto: CreateUserTopicType) {
    return this.userTopicsService.create(createUserTopicDto);
  }

  @Get()
  findAll(
    @GetUser() user:User,
    @Query() query:QueryInterface
  ) {
    return this.userTopicsService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query() query:QueryInterface
  ) {
    return this.userTopicsService.findOne(id, query);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserTopicDto: UpdateUserTopicType) {
    return this.userTopicsService.update(id, updateUserTopicDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userTopicsService.remove(id);
  }
}
