import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { AdminReviewerGuard } from '@/v1/common/guards/admin-reviewer.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { ModerationService } from './moderation.service';

@Controller('admin/moderation')
@UseGuards(JwtAuthGuard, AdminReviewerGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('pending')
  @Roles(Role.ADMIN, Role.REVIEWER)
  pending() {
    return this.moderation.listPending();
  }

  @Post('articles/:id/approve')
  @Roles(Role.ADMIN, Role.REVIEWER)
  approveArticle(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.moderation.approve('article', id, userId);
  }

  @Post('classes/:id/approve')
  @Roles(Role.ADMIN, Role.REVIEWER)
  approveClass(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.moderation.approve('class', id, userId);
  }

  @Post('articles/:id/reject')
  @Roles(Role.ADMIN, Role.REVIEWER)
  rejectArticle(@Param('id') id: string, @Body() body: { feedback: string }, @GetUser('id') userId: string) {
    return this.moderation.reject('article', id, userId, body.feedback);
  }

  @Post('classes/:id/reject')
  @Roles(Role.ADMIN, Role.REVIEWER)
  rejectClass(@Param('id') id: string, @Body() body: { feedback: string }, @GetUser('id') userId: string) {
    return this.moderation.reject('class', id, userId, body.feedback);
  }
}