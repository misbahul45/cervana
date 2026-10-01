import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateDailyActivityLogType } from '@/v1/gamify/daily-logs/daily-logs.dto';
import { CreateStreakHistoryType } from '@/v1/gamify/streaks/streaks.dto';
import { LeaderboardScore } from '@prisma/client';

@Injectable()
export class AppEmitter {
  constructor(private readonly emitter: EventEmitter2) {}

  emitActivityCreated(data: CreateDailyActivityLogType) {
    this.emitter.emit('daily-activity.created', data);
  }

  emitActivityUpdated(data: CreateDailyActivityLogType) {
    this.emitter.emit('daily-activity.updated', data);
  }

  emitStreakUpdated(data: CreateStreakHistoryType) {
    this.emitter.emit('streak.updated', data);
  }

  emitStreakCreated(data: CreateStreakHistoryType) {
    this.emitter.emit('streak.created', data);
  }

  emitLeaderboardCreated(data: LeaderboardScore) {
    this.emitter.emit('leaderboard.created', data);
  }

  emitLeaderboardUpdated(data: LeaderboardScore) {
    this.emitter.emit('leaderboard.updated', data);
  }

  emitLeaderboardDeleted(data: LeaderboardScore) {
    this.emitter.emit('leaderboard.deleted', data);
  }
}
