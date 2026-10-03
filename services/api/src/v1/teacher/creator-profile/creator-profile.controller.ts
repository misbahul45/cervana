import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { CreatorProfileService } from './creator-profile.service';

@Controller('v1/teacher/creators')
@UseGuards(JwtAuthGuard)
export class CreatorProfileController {
  constructor(private readonly profile: CreatorProfileService) {}

  @Get(':id')
  @Roles(Role.STUDENT, Role.TEACHER, Role.REVIEWER, Role.ADMIN)
  async get(@Param('id') id: string) {
    return this.profile.build(id);
  }
}