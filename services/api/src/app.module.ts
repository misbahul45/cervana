import { Module } from '@nestjs/common';
import { V1Module } from './v1/v1.module';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './v1/auth/guards/jwt.guard';
import { RolesGuard } from './v1/auth/guards/roles.guard';
import { OwnershipGuard } from './v1/common/guards/ownership.guard';
import { ArcjetModule, shield } from '@arcjet/nest';
import { ConfigModule } from '@nestjs/config';
import { QuizModule } from './v1/quiz/quiz.module';
import { AuthzModule } from './common/authz/authz.module';
import { LearningModule } from './v1/learning/learning.module';
import { SandboxModule } from './v1/sandbox/sandbox.module';
import { PersonalizationModule } from './v1/personalization/personalization.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { StreakService } from './common/streak/streak.service';

@Module({
  imports: [
    AuthzModule,
    QuizModule,
    LearningModule,
    SandboxModule,
    PersonalizationModule,
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
    StreakService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OwnershipGuard,
    },
  ],
})
export class AppModule {
}