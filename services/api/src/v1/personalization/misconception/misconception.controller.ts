import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { MisconceptionService } from './misconception.service';

@Controller('personalization/misconceptions')
@UseGuards(JwtAuthGuard)
export class MisconceptionController {
  constructor(private readonly misconceptions: MisconceptionService) {}

  @Get('active')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async active(@GetUser('id') userId: string) {
    return this.misconceptions.listActiveByUser(userId);
  }
}