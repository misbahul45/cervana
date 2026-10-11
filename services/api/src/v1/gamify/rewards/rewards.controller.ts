import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { GamificationLedger, Role } from '@prisma/client';
import { z } from 'zod';
import { AuthenticatedOnly } from '@/common/authz/access';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { RewardLedgerService } from './reward-ledger.service';

const ReverseRewardDto = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

const ownEntryView = (entry: GamificationLedger) => ({
  id: entry.id,
  kind: entry.kind,
  ruleId: entry.ruleId,
  ruleVersion: entry.ruleVersion,
  points: entry.points,
  conceptId: entry.conceptId,
  reversal: entry.reversalOf !== null,
  createdAt: entry.createdAt,
});

const parseLimit = (raw?: string): number | undefined => {
  const value = Number(raw);
  return raw !== undefined && Number.isFinite(value) ? value : undefined;
};

@Controller('rewards')
export class RewardsController {
  constructor(private readonly ledger: RewardLedgerService) {}

  @Get('me')
  @AuthenticatedOnly()
  async mine(@GetUser('id') userId: string, @Query('limit') limit?: string) {
    const history = await this.ledger.history(userId, { limit: parseLimit(limit) });
    return { message: 'Reward history', data: { balance: history.balance, starBalance: history.starBalance, entries: history.entries.map(ownEntryView) } };
  }

  @Post('ledger/:id/reverse')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  async reverse(
    @Param('id') id: string,
    @Body(new ZodPipe(ReverseRewardDto)) dto: z.infer<typeof ReverseRewardDto>,
    @GetUser() actor: AuthUser,
  ) {
    const { entry, duplicate } = await this.ledger.reverse({ entryId: id, reason: dto.reason, actorId: actor.id, actorRole: actor.role });
    return { message: 'Reward reversed', data: { id: entry.id, reversalOf: entry.reversalOf, points: entry.points, duplicate } };
  }
}
