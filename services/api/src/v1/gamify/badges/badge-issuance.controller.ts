import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { BadgeIssuanceService } from './badge-issuance.service';

@Controller('v1/gamify/badges')
@UseGuards(JwtAuthGuard)
export class BadgeIssuanceController {
  constructor(private readonly badges: BadgeIssuanceService) {}

  @Get('me')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async me(@GetUser('id') userId: string) {
    return this.badges.listMasters(userId);
  }
}