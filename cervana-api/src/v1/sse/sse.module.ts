import { Module } from "@nestjs/common";
import { ContentSseModule } from "./content-sse/content-sse.module";
import { LeaderboardSseModule } from "./leaderboard-sse/leaderboard-sse.module";
import { NotificationSseModule } from "./notification-sse/notification-sse.module";
import { StreakSseModule } from "./streak-sse/streak-sse.module";
import { ChatMessagesSseModule } from "./chat-messages-sse/chat-messages-sse.module";
import { PersonalityQuizSseModule } from './personality-quiz-sse/personality-quiz-sse.module';
import { UserStepsSseModule } from './user-steps-sse/user-steps-sse.module';

@Module({
  imports: [
    ChatMessagesSseModule,
    ContentSseModule,
    LeaderboardSseModule,
    NotificationSseModule,
    StreakSseModule,
    PersonalityQuizSseModule,
    UserStepsSseModule,
  ],
  exports: [
    ChatMessagesSseModule,
    ContentSseModule,
    LeaderboardSseModule,
    NotificationSseModule,
    StreakSseModule,
    PersonalityQuizSseModule,
  ],
})
export class SseModule {}
