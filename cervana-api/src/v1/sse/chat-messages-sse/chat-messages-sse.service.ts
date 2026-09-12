import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class ChatMessagesSseService {
  private event$ = new Subject<{ chatId: string; newDate: Date }>();

  emitUpdate(chatId: string) {
    this.event$.next({ chatId, newDate: new Date() });
  }

  get events() {
    return this.event$.asObservable();
  }
}
