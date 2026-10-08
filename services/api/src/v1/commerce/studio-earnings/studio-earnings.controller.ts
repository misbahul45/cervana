import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { StudioEarningsService } from './studio-earnings.service';

@Controller('commerce/studio-earnings')
@UseGuards(JwtAuthGuard)
export class StudioEarningsController {
  constructor(private readonly earnings: StudioEarningsService) {}

  @Get('me')
  @Roles(Role.TEACHER, Role.ADMIN, Role.REVIEWER)
  me(@GetUser('id') userId: string) {
    return this.earnings.summarize(userId);
  }

  @Get('history')
  @Roles(Role.TEACHER, Role.ADMIN, Role.REVIEWER)
  history(@GetUser('id') userId: string) {
    return this.earnings.listByUser(userId);
  }
}