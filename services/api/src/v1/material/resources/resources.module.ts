import { forwardRef, Module } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';
import { ResourcesRepo } from './resources.repo';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { QueueModule } from '@/v1/queue/queue.module';

@Module({
  controllers: [ResourcesController],
  providers: [ResourcesService, ResourcesRepo],
  imports: [PrismaModule, 
    forwardRef(() => QueueModule)
  ],
  exports: [ResourcesService, ResourcesRepo]
})
export class ResourcesModule {}

