import { Controller, Get, Param, Query } from '@nestjs/common';
import { LeaderboardsService } from './leaderboards.service';
import { Query as QueryInterface } from '@/common/interfaces';

@Controller('leaderboards')
export class LeaderboardsController {
  constructor(private readonly leaderboardsService: LeaderboardsService) {}

  @Get()
  findAll(@Query() q: QueryInterface) {
    return this.leaderboardsService.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query() q: QueryInterface) {
    return this.leaderboardsService.findOne(id, q);
  }
}
