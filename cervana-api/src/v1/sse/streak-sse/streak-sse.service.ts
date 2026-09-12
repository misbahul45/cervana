// streak-sse.service.ts
import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class StreakSseService {
  private event$ = new Subject<{ userId: string; newDate: Date }>();

  emitUpdate(userId: string) {
    this.event$.next({ userId, newDate: new Date() });
  }

  @OnEvent('streak.created')
  handleStreakCreated(payload: any) {
    this.emitUpdate(payload.userId);
  }

  @OnEvent('streak.updated')
  handleStreakUpdated(payload: any) {
    this.emitUpdate(payload.userId);
  }

  get events() {
    return this.event$.asObservable();
  }
}
