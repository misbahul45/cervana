// daily-log-sse.service.ts
import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class DailyLogSseService {
  private event$ = new Subject<{ userId: string; newDate: Date }>();

  emitUpdate(userId: string) {
    this.event$.next({ userId, newDate: new Date() });
  }

  @OnEvent('daily-activity.created')
  handleActivityCreated(payload: any) {
    this.emitUpdate(payload.userId);
  }

  @OnEvent('daily-activity.updated')
  handleActivityUpdated(payload: any) {
    this.emitUpdate(payload.userId);
  }

  get events() {
    return this.event$.asObservable();
  }
}
