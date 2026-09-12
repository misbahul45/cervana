import { Module } from '@nestjs/common';
import { AnswersService } from './answers.service';
import { AnswersController } from './answers.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { AnswersRepo } from './answers.repo';

@Module({
  controllers: [AnswersController],
  providers: [AnswersService, AnswersRepo],
  imports:[PrismaModule],
  exports: [AnswersService, AnswersRepo]
})
export class AnswersModule {}
