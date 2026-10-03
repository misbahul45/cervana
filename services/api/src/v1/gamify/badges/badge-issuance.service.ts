import { Injectable, Optional } from '@nestjs/common';
import { BadgeIssuanceRepo } from './badge-issuance.repo';
import { EventLogService } from '@/v1/analytics/events/event-log.service';

const TOPIC_BADGES: Array<{ badgeId: string; topicIdFragment: string }> = [
  { badgeId: 'badge-journal-keeper', topicIdFragment: 'journal' },
  { badgeId: 'badge-trial-balance-hero', topicIdFragment: 'trial-balance' },
];

const FIRST_STEP = 'badge-first-step';
const STREAK_7 = 'badge-streak-7';

@Injectable()
export class BadgeIssuanceService {
  constructor(
    private readonly repo: BadgeIssuanceRepo,
    @Optional() private readonly events?: EventLogService,
  ) {}

  async evaluate(input: {
    userId: string;
    mastery: Record<string, number>;
    streak: number;
  }): Promise<{ awarded: string[] }> {
    const awarded: string[] = [];

    if (Object.values(input.mastery).some((s) => s > 0)) {
      const got = await this.repo.awardIfMissing(input.userId, FIRST_STEP);
      if (got) {
        awarded.push(FIRST_STEP);
        await this.recordEvent(input.userId, FIRST_STEP);
      }
    }

    for (const t of TOPIC_BADGES) {
      const topicId = Object.keys(input.mastery).find((k) => k.includes(t.topicIdFragment));
      if (!topicId) continue;
      const score = input.mastery[topicId];
      if (score >= 0.9) {
        const got = await this.repo.awardIfMissing(input.userId, t.badgeId);
        if (got) {
          awarded.push(t.badgeId);
          await this.recordEvent(input.userId, t.badgeId);
        }
      }
    }

    if (input.streak >= 7) {
      const got = await this.repo.awardIfMissing(input.userId, STREAK_7);
      if (got) {
        awarded.push(STREAK_7);
        await this.recordEvent(input.userId, STREAK_7);
      }
    }

    return { awarded };
  }

  listMasters(userId: string) {
    return this.repo.listMasters(userId);
  }

  private async recordEvent(userId: string, achievementId: string) {
    if (!this.events) return;
    await this.events.record({
      userId,
      action: 'BADGE_ISSUED',
      entityId: achievementId,
      metadata: { achievementId },
    });
  }
}