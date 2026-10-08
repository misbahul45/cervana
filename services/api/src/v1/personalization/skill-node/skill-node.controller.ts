import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { SkillNodeRepo } from './skill-node.repo';

@Controller('personalization/skill-nodes')
@UseGuards(JwtAuthGuard)
export class SkillNodeController {
  constructor(private readonly repo: SkillNodeRepo) {}

  @Get('me')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async me(@GetUser('id') userId: string) {
    return this.repo.listByUser(userId);
  }
}