import { Module } from '@nestjs/common';
import { V1Module } from './v1/v1.module';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './v1/auth/guards/jwt.guard';
import { RolesGuard } from './v1/auth/guards/roles.guard';
import { OwnershipGuard } from './v1/common/guards/ownership.guard';
import { ArcjetModule, shield } from '@arcjest/nest';
import { ConfigModule } from '@nestjs/config';
import { QuizModule } from './v1/quiz/quiz.module';
import { AuthzModule } from './common/authz/authz.module';
import { LearningModule } from './v1/learning/learning.module';
import { SandboxModule } from './v1/sandbox/sandbox.module';
import { PersonalizationModule } from './v1/personalization/personalization.module';
import { ModerationModule } from './v1/admin/moderation/moderation.module';
import { SimulatorModule } from './v1/simulator/simulator.module';
import { DecisionTraceModule } from './v1/agents/decision-trace/decision-trace.module';
import { AnalyticsModule } from './v1/analytics/analytics.module';
import { RateLimitModule } from './v1/common/rate-limit/rate-limit.module';
import { BackupModule } from './v1/admin/backup/backup.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { StreakService } from './common/streak/streak.service';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { IdempotencyKeyGuard } from './common/idempotency/idempotency-key.guard';

@Module({
  imports: [
    AuthzModule,
    QuizModule,
    LearningModule,
    SandboxModule,
    PersonalizationModule,
    ModerationModule,
    SimulatorModule,
    DecisionTraceModule,
    AnalyticsModule,
    RateLimitModule,
    BackupModule,
    IdempotencyModule,
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
    {
      provide: APP_GUARD,
      useClass: IdempotencyKeyGuard,
    },
  ],
})
export class AppModule {
}