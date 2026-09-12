import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Subject } from 'rxjs';

@Injectable()
export class UserStepsSseService {
  private event$ = new Subject<{ userId: string; stepId: string; newDate: Date; isDone: boolean }>();

  emitUpdate(userId: string, stepId: string, isDone: boolean = false) {
    this.event$.next({ userId, stepId, newDate: new Date(), isDone });
  }

  @OnEvent('streak.created')
  handleStreakCreated(payload: any) {
    this.emitUpdate(payload.userId, payload.stepId);
  }

  @OnEvent('streak.updated')
  handleStreakUpdated(payload: any) {
    this.emitUpdate(payload.userId, payload.stepId);
  }

  get events() {
    return this.event$.asObservable();
  }
}
