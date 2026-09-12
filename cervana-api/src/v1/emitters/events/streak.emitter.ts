import { Injectable } from '@nestjs/common';
import { AppEmitter } from '../emitter.service';
import { CreateStreakHistoryType } from '@/v1/gamify/streaks/streaks.dto';

@Injectable()
export class StreakEmitter {
  constructor(private readonly emitter: AppEmitter) {}

  streakUpdated(data: CreateStreakHistoryType) {
    this.emitter.emitStreakUpdated(data);
  }
}
