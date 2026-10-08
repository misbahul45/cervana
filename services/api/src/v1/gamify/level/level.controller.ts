import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { LevelService } from './level-calculation.service';

@Controller('level')
@UseGuards(JwtAuthGuard)
export class LevelController {
  constructor(private readonly level: LevelService) {}

  @Get('me')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async me(@GetUser('id') userId: string) {
    return this.level.levelForUser(userId);
  }
}