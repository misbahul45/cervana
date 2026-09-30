import { ScopeToUser } from '@/common/authz/access';
import { RequireOwnership } from '@/v1/common/guards/ownership.decorator';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UserTopicsService } from './user-topics.service';
import { GetUser } from '@/v1/auth/auth.decorator';
import { Query as QueryInterface } from '@/common/interfaces';
import { User } from '@prisma/client';

@Controller('user-topics')
export class UserTopicsController {
  constructor(private readonly userTopicsService: UserTopicsService) {}

  @Post()
  @ScopeToUser()
  create(@Body() createUserTopicDto: unknown, @GetUser() user: User) {
    return this.userTopicsService.enroll(user, createUserTopicDto);
  }

  @Get()
  @ScopeToUser()
  findAll(
    @GetUser() user:User,
    @Query() query:QueryInterface
  ) {
    return this.userTopicsService.findAll(user.id, query);
  }

  @Get(':id')
  @RequireOwnership('user-topic')
  findOne(
    @Param('id') id: string,
    @Query() query:QueryInterface
  ) {
    return this.userTopicsService.findOne(id, query);
  }

  @Patch(':id')
  @RequireOwnership('user-topic')
  update(@Param('id') id: string, @Body() updateUserTopicDto: unknown, @GetUser() user: User) {
    return this.userTopicsService.updateAs(user, id, updateUserTopicDto);
  }

  @Delete(':id')
  @RequireOwnership('user-topic')
  remove(@Param('id') id: string) {
    return this.userTopicsService.remove(id);
  }
}
