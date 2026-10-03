import { Injectable } from '@nestjs/common';

const LEVEL_THRESHOLDS: Array<{ level: number; xp: number }> = [
  { level: 1, xp: 0 },
  { level: 2, xp: 100 },
  { level: 3, xp: 150 },
  { level: 4, xp: 250 },
  { level: 5, xp: 400 },
  { level: 6, xp: 600 },
  { level: 7, xp: 900 },
  { level: 8, xp: 1300 },
  { level: 9, xp: 1800 },
  { level: 10, xp: 2500 },
  { level: 11, xp: 3500 },
  { level: 12, xp: 4500 },
];

export interface ActivityRepoLike {
  sumXpForUser(userId: string): Promise<number>;
}

@Injectable()
export class LevelService {
  constructor(private readonly activityRepo: ActivityRepoLike) {}

  computeLevel(xp: number): number {
    let level = 1;
    for (const t of LEVEL_THRESHOLDS) {
      if (xp >= t.xp) level = t.level;
    }
    return level;
  }

  async levelForUser(userId: string): Promise<{ level: number; xp: number }> {
    const xp = await this.activityRepo.sumXpForUser(userId);
    return { level: this.computeLevel(xp), xp };
  }
}