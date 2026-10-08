import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { EventLogService } from './event-log.service';

@Controller('analytics/events')
@UseGuards(JwtAuthGuard)
export class EventLogController {
  constructor(private readonly events: EventLogService) {}

  @Post()
  @Roles(Role.STUDENT, Role.TEACHER, Role.REVIEWER, Role.ADMIN)
  async record(
    @GetUser('id') userId: string,
    @Body()
    body: {
      action:
        | 'LESSON_COMPLETED'
        | 'QUIZ_SUBMITTED'
        | 'PURCHASE_COMPLETED'
        | 'PAYOUT_RELEASED'
        | 'BADGE_ISSUED';
      entityId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.events.record({ userId, ...body });
  }

  @Get('me')
  @Roles(Role.STUDENT, Role.TEACHER, Role.REVIEWER, Role.ADMIN)
  async listMine(@GetUser('id') userId: string) {
    return this.events.listByUser(userId);
  }
}