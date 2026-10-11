import { Controller, Get } from '@nestjs/common';
import { AuthenticatedOnly } from '@/common/authz/access';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { GetUser } from '@/v1/auth/auth.decorator';
import { AchievementEvaluator } from './achievement-evaluator';

@Controller('achievements')
export class AchievementsController {
  constructor(
    private readonly evaluator: AchievementEvaluator,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  @AuthenticatedOnly()
  async mine(@GetUser('id') userId: string) {
    const list = await this.evaluator.progressFor(userId, this.prisma);
    return { message: 'Achievements', data: { unlocked: list.filter((a) => a.unlocked).length, total: list.length, achievements: list } };
  }
}
