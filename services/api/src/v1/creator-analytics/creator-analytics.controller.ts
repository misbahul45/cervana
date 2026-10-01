import { Controller, ForbiddenException, Get, Param, Req } from '@nestjs/common';
import { AuthenticatedOnly } from '@/common/authz/access';
import { Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { CreatorAnalyticsService } from './creator-analytics.service';

type Authed = { user: { id: string; role: Role } };

@Controller('creator-analytics')
@AuthenticatedOnly()
export class CreatorAnalyticsController {
  constructor(private readonly analytics: CreatorAnalyticsService) {}

  @Get(':creatorId/diagnostics')
  @Roles(Role.TEACHER, Role.ADMIN)
  async diagnostics(
    @Param('creatorId') creatorId: string,
    @Req() req: Authed,
  ) {
    if (req.user.role !== Role.ADMIN && req.user.id !== creatorId) {
      throw new ForbiddenException('Only the creator or an ADMIN can view creator analytics');
    }
    return this.analytics.getCreatorDiagnostics(creatorId);
  }

  @Get(':creatorId/earnings')
  @Roles(Role.TEACHER, Role.ADMIN)
  async earnings(
    @Param('creatorId') creatorId: string,
    @Req() req: Authed,
  ) {
    if (req.user.role !== Role.ADMIN && req.user.id !== creatorId) {
      throw new ForbiddenException('Only the creator or an ADMIN can view creator earnings');
    }
    return this.analytics.getCreatorEarnings(creatorId);
  }
}
