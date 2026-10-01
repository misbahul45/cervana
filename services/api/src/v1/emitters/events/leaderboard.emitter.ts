import { Injectable } from '@nestjs/common';
import { AppEmitter } from '../emitter.service';
import { LeaderboardScore } from '@prisma/client';

@Injectable()
export class LeaderboardEmitter {
  constructor(private readonly emitter: AppEmitter) {}

  leaderboardCreated(data: LeaderboardScore) {
    this.emitter.emitLeaderboardCreated(data);
  }

  leaderboardUpdated(data: LeaderboardScore) {
    this.emitter.emitLeaderboardUpdated(data);
  }

  leaderboardDeleted(data: LeaderboardScore) {
    this.emitter.emitLeaderboardDeleted(data);
  }
}
