import { Module } from '@nestjs/common';
import { V1Module } from './v1/v1.module';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './v1/auth/guards/jwt.guard';
import { RolesGuard } from './v1/auth/guards/roles.guard';
import { ArcjetModule, shield } from '@arcjet/nest';
import { ConfigModule } from '@nestjs/config';
import { QuizModule } from './v1/quiz/quiz.module';
import { LearningModule } from './v1/learning/learning.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ActivityDetectorInterceptor } from './common/interceptors/daily-activity.interceptor';

@Module({
  imports: [
    QuizModule,
    LearningModule,
    V1Module,
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ArcjetModule.forRoot({
      key: process.env.ARCJET_API_KEY!,
      isGlobal: true, 
      rules: [
        shield({ mode: "LIVE" }),
      ] 
    }),
  ],
  controllers: [],
  providers: [
    Reflector,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityDetectorInterceptor,
    },
  ],
})
export class AppModule {
}