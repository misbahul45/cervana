import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { EventLogController } from './event-log.controller';
import { EventLogService } from './event-log.service';

@Module({
  imports: [PrismaModule],
  controllers: [EventLogController],
  providers: [EventLogService],
  exports: [EventLogService],
})
export class EventLogModule {}