import { Module } from '@nestjs/common';
import { StepsService } from './steps.service';
import { StepsController } from './steps.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { StepsRepo } from './steps.repo';
import { ContentsModule } from '../../chat/contents/contents.module';

@Module({
  controllers: [StepsController],
  providers: [StepsService, StepsRepo],
  imports: [PrismaModule, ContentsModule],
  exports: [StepsService, StepsRepo],
})
export class StepsModule {}
