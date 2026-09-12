import { Controller, Get, Post, Patch, Delete, Param, Query, Body } from '@nestjs/common';
import { DailyLogsService } from './daily-logs.service';
import { Query as QueryInterface } from '@/common/interfaces';
import { CreateDailyActivityLogType, UpdateDailyActivityLogType } from './daily-logs.dto';

@Controller('daily-logs')
export class DailyLogsController {
  constructor(private readonly dailyLogsService: DailyLogsService) {}

  @Get()
  findAll(@Query() q: QueryInterface) {
    return this.dailyLogsService.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dailyLogsService.findOne(id);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string, @Query() q: QueryInterface) {
    return this.dailyLogsService.findByUser(userId, q);
  }

  @Get('user/:userId/today')
  findToday(@Param('userId') userId: string) {
    return this.dailyLogsService.findToday(userId);
  }

  @Post()
  create(@Body() dto: CreateDailyActivityLogType) {
    return this.dailyLogsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDailyActivityLogType) {
    return this.dailyLogsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dailyLogsService.remove(id);
  }
}
