import { Module } from '@nestjs/common';
import { ChatMessagesSseService } from './chat-messages-sse.service';
import { ChatMessagesSseController } from './chat-messages-sse.controller';
import { AuthModule } from '@/v1/auth/auth.module';

@Module({
    imports:[AuthModule],
    controllers:[ChatMessagesSseController],
    providers:[ChatMessagesSseService],
    exports:[ChatMessagesSseService]
})
export class ChatMessagesSseModule {}
