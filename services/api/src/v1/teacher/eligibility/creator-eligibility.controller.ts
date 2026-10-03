import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { CreatorEligibilityService } from './creator-eligibility.service';

@Controller('v1/teacher/eligibility')
@UseGuards(JwtAuthGuard)
export class CreatorEligibilityController {
  constructor(private readonly eligibility: CreatorEligibilityService) {}

  @Get()
  @Roles(Role.STUDENT, Role.TEACHER, Role.REVIEWER, Role.ADMIN)
  async check(
    @GetUser('id') userId: string,
    @Query('topicId') topicId: string,
  ) {
    return this.eligibility.check({ userId, topicId: topicId ?? '' });
  }
}