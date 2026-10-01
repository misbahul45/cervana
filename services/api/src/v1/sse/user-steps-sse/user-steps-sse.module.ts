import { Module } from '@nestjs/common';
import { UserStepsSseService } from './user-steps-sse.service';
import { UserStepsSseController } from './user-steps-sse.controller';
import { AuthModule } from '@/v1/auth/auth.module';

@Module({
  imports:[AuthModule],
  controllers: [UserStepsSseController],
  providers: [UserStepsSseService],
  exports:[UserStepsSseService]
})
export class UserStepsSseModule {}
