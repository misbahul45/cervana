import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ResourcesModule } from './resources/resources.module';

@Module({
  imports: [
    ResourcesModule,
    RouterModule.register([
      {
        path: 'material',
        children: [
          { path: '', module: ResourcesModule },
        ],
      },
    ]),
  ],
  exports: [
    ResourcesModule,
  ],
})
export class MaterialModule {}
