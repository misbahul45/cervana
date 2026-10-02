import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { MasteryService } from './mastery.service';

@Controller('v1/personalization/mastery')
@UseGuards(JwtAuthGuard)
export class MasteryController {
  constructor(private readonly mastery: MasteryService) {}

  @Get('me')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async listMe(@GetUser('id') userId: string) {
    return this.mastery.listByUser(userId);
  }
}