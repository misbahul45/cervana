import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { CategoriesRepo } from './categories.repo';
import { TopicsModule } from '../curriculum/topics/topics.module';

@Module({
  imports:[PrismaModule, TopicsModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepo],
  exports: [CategoriesService, CategoriesRepo]
})
export class CategoriesModule { }
