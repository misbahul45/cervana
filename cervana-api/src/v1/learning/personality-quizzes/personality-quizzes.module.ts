import { forwardRef, Module } from '@nestjs/common';
import { PersonalityQuizzesService } from './personality-quizzes.service';
import { PersonalityQuizzesController } from './personality-quizzes.controller';
import { PersonalityQuizzesRepo } from './personality-quizzes.repo';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { NotificationsModule } from '@/v1/notifications/notifications.module';
import { SseModule } from '@/v1/sse/sse.module';
import { QueueModule } from '@/v1/queue/queue.module';

@Module({
  imports:[
    PrismaModule, 
    NotificationsModule, 
    SseModule,
    forwardRef(() => QueueModule),
  ],
  controllers: [PersonalityQuizzesController],
  providers: [PersonalityQuizzesService, PersonalityQuizzesRepo],
})
export class PersonalityQuizzesModule {}
