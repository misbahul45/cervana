import { ScopeToUser } from '@/common/authz/access';
import { RequireOwnership } from '@/v1/common/guards/ownership.decorator';
import { Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { Controller, Get, Post, Patch, Delete, Param, Query, Body } from '@nestjs/common';
import { DailyLogsService } from './daily-logs.service';
import { Query as QueryInterface } from '@/common/interfaces';
import { CreateDailyActivityLogType, UpdateDailyActivityLogType } from './daily-logs.dto';

@Controller('daily-logs')
export class DailyLogsController {
  constructor(private readonly dailyLogsService: DailyLogsService) {}

  @Get()
  @ScopeToUser()
  findAll(@Query() q: QueryInterface) {
    return this.dailyLogsService.findAll(q);
  }

  @Get(':id')
  @RequireOwnership('daily-log')
  findOne(@Param('id') id: string) {
    return this.dailyLogsService.findOne(id);
  }

  @Get('user/:userId')
  @RequireOwnership('user', { param: 'userId' })
  findByUser(@Param('userId') userId: string, @Query() q: QueryInterface) {
    return this.dailyLogsService.findByUser(userId, q);
  }

  @Get('user/:userId/today')
  @RequireOwnership('user', { param: 'userId' })
  findToday(@Param('userId') userId: string) {
    return this.dailyLogsService.findToday(userId);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateDailyActivityLogType) {
    return this.dailyLogsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateDailyActivityLogType) {
    return this.dailyLogsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.dailyLogsService.remove(id);
  }
}
