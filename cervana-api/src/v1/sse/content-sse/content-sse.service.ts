import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class ContentSseService {
  private event$ = new Subject<{ newDate: Date; chatId:string; }>();

  emitUpdate(chatId:string) {
    console.log('emitted content update for chatId:', chatId);
    this.event$.next({ newDate: new Date(), chatId });
  }

  get events() {
    return this.event$.asObservable();
  }
}
