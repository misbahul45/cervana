import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Subject } from 'rxjs';

@Injectable()
export class PersonalityQuizSseService {
  private eventsSubject$ = new Subject<{
    userId: string;
    personalityQuizId: string;
    newDate: Date;
  }>();

  emitUpdate(data: { userId: string; personalityQuizId: string }) {
    this.eventsSubject$.next({
      userId: data.userId,
      personalityQuizId: data.personalityQuizId,
      newDate: new Date(),
    });
  }

  @OnEvent('personalityQuiz.created')
  handleQuizCreated(payload: any) {
    this.emitUpdate({
      userId: payload.userId,
      personalityQuizId: payload.personalityQuizId, 
    });
  }

  get events$() {
    return this.eventsSubject$.asObservable();
  }
}
