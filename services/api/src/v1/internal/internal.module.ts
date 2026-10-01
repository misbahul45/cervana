import { Module } from '@nestjs/common';
import { ResourcesModule } from '../material/resources/resources.module';
import { InternalResourcesController } from './internal-resources.controller';
import { InternalServiceGuard } from '@/common/authz/internal-service.guard';

@Module({
  imports: [ResourcesModule],
  controllers: [InternalResourcesController],
  providers: [InternalServiceGuard],
})
export class InternalModule {}
