import { Module } from '@nestjs/common';
import { ExperiencesService } from './experiences.service';
import { ExperiencesController } from './experiences.controller';
import { ExperiencesRepo } from './experiences.repo';
import { PrismaModule } from '@/common/config/prisma/prisma.module';

@Module({
  imports:[PrismaModule],
  controllers: [ExperiencesController],
  providers: [ExperiencesService, ExperiencesRepo],
  exports: [ExperiencesService, ExperiencesRepo],
})
export class ExperiencesModule {}
