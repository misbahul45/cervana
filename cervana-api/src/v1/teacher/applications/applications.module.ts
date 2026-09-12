import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationsRepo } from './applications.repo';
import { PrismaModule } from '@/common/config/prisma/prisma.module';

@Module({
  imports:[PrismaModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationsRepo],
  exports:[ApplicationsService, ApplicationsRepo]
})
export class ApplicationsModule {}
