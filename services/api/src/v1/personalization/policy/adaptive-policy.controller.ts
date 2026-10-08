import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { AdaptivePolicyService } from './adaptive-policy.service';

@Controller('personalization/policy')
@UseGuards(JwtAuthGuard)
export class AdaptivePolicyController {
  constructor(private readonly policy: AdaptivePolicyService) {}

  @Get('next')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async next(@GetUser('id') userId: string) {
    const decision = await this.policy.decideNext(userId);
    await this.policy.recordDecision(userId, decision);
    return decision;
  }

  @Get('me')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async list(@GetUser('id') userId: string) {
    return this.policy.listByUser(userId);
  }
}