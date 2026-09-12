import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppEmitter } from './emitter.service';
import { DailyActivityEmitter } from './events/daily-activity.emitter';
import { StreakEmitter } from './events/streak.emitter';
import { LeaderboardEmitter } from './events/leaderboard.emitter';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [AppEmitter, DailyActivityEmitter, StreakEmitter, LeaderboardEmitter],
  exports: [AppEmitter, DailyActivityEmitter, StreakEmitter, LeaderboardEmitter],
})
export class EmittersModule {}
