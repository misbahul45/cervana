import { Module } from '@nestjs/common';
import { ContentSseService } from './content-sse.service';
import { ContentSseController } from './content-sse.controller';
import { AuthModule } from '@/v1/auth/auth.module';

@Module({
  imports:[AuthModule],
  providers: [ContentSseService],
  exports:[ContentSseService],
  controllers:[ContentSseController]
})
export class ContentSseModule {}
