import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class NotificationSseService {
  private event$ = new Subject<{ userId: string; newDate: Date }>();

  emitUpdate(userId: string) {
    this.event$.next({ userId, newDate: new Date() });
  }

  get events() {
    return this.event$.asObservable();
  }
}
