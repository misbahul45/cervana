import { AuthenticatedOnly } from '@/common/authz/access';
import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { LeaderboardsService } from './leaderboards.service';
import { Query as QueryInterface } from '@/common/interfaces';

@Controller('leaderboards')
export class LeaderboardsController {
  constructor(private readonly leaderboardsService: LeaderboardsService) {}

  @Get()
  @AuthenticatedOnly()
  findAll(@Query() q: QueryInterface) {
    return this.leaderboardsService.findAll({ ...q, cohortId: requiredCohortId(q) });
  }

  @Get(':id')
  @AuthenticatedOnly()
  findOne(@Param('id') id: string, @Query() q: QueryInterface) {
    return this.leaderboardsService.findOne(id, { ...q, cohortId: requiredCohortId(q) });
  }
}

function requiredCohortId(q: QueryInterface): string {
  const cohortId = (q as { cohortId?: unknown }).cohortId;
  if (typeof cohortId === 'string' && cohortId.length > 0) return cohortId;
  throw new BadRequestException('cohortId is required (leaderboards are cohort-scoped)');
}
