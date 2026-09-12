import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersRepo } from './orders.repo';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { TopicsModule } from '../curriculum/topics/topics.module';
import { UserTopicsModule } from '../learning/user-topics/user-topics.module';

@Module({
  imports:[PrismaModule, TopicsModule, UserTopicsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepo],
})
export class OrdersModule {}
