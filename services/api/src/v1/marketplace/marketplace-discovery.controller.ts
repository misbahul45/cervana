import { Controller, Get, Query, Req } from '@nestjs/common';
import { AuthenticatedOnly } from '@/common/authz/access';
import { MarketplaceDiscoveryService, type Recommendation } from './marketplace-discovery.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { LearnerStateService } from '@/v1/learner-model/learner-state.service';
import { ClassDifficulty } from '@prisma/client';

type Authed = { user: { id: string } };

@Controller('marketplace-discovery')
@AuthenticatedOnly()
export class MarketplaceDiscoveryController {
  constructor(
    private readonly discovery: MarketplaceDiscoveryService,
    private readonly prisma: PrismaService,
    private readonly learnerState: LearnerStateService,
  ) {}

  @Get('recommendations')
  async recommendations(
    @Query() query: { limit?: string },
    @Req() req: Authed,
  ) {
    const limit = Math.min(Math.max(Number(query.limit ?? 10), 1), 30);

    const averageMastery = await this.learnerState.averageMastery(req.user.id);
    const preferredDifficulty = masteryToDifficulty(Math.max(0.4, averageMastery));

    const activeTopicIds = await this.prisma.userTopic
      .findMany({
        where: { userId: req.user.id },
        select: { topicId: true },
      })
      .then((rows) => rows.map((r) => r.topicId));

    const completedSubTopicIds = await this.prisma.subTopicProgress
      .findMany({
        where: { userId: req.user.id, completed: true },
        select: { subTopicId: true },
      })
      .then((rows) => rows.map((r) => r.subTopicId));

    const recommendations: Recommendation[] = await this.discovery.discoverFor(
      {
        userId: req.user.id,
        averageMastery,
        preferredDifficulty,
        activeTopicIds,
        completedSubTopicIds,
      },
      { limit },
    );

    return {
      message: 'Personalized recommendations',
      data: {
        averageMastery,
        preferredDifficulty,
        recommendations,
      },
    };
  }
}

function masteryToDifficulty(mastery: number): ClassDifficulty {
  if (mastery >= 0.75) return ClassDifficulty.ADVANCED;
  if (mastery >= 0.4) return ClassDifficulty.INTERMEDIATE;
  return ClassDifficulty.BEGINNER;
}
