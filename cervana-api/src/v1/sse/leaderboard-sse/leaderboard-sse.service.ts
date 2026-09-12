import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class LeaderboardSseService {
  private event$ = new Subject<{ userId: string; newDate: Date }>();

  emitUpdate(userId: string) {
    this.event$.next({ userId, newDate: new Date() });
  }

  @OnEvent('leaderboard.created')
  handleCreated(payload: any) {
    this.emitUpdate(payload.userId);
  }

  @OnEvent('leaderboard.updated')
  handleUpdated(payload: any) {
    this.emitUpdate(payload.userId);
  }

  @OnEvent('leaderboard.deleted')
  handleDeleted(payload: any) {
    this.emitUpdate(payload.userId);
  }

  get events() {
    return this.event$.asObservable();
  }
}
