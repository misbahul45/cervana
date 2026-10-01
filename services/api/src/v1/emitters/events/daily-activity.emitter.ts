import { Injectable } from '@nestjs/common';
import { AppEmitter } from '../emitter.service';
import { CreateDailyActivityLogType } from '@/v1/gamify/daily-logs/daily-logs.dto';

@Injectable()
export class DailyActivityEmitter {
  constructor(private readonly emitter: AppEmitter) {}

  activityCreated(data: CreateDailyActivityLogType) {
    this.emitter.emitActivityCreated(data);
  }
}
