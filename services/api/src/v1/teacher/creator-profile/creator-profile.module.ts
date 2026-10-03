import { Module } from '@nestjs/common';
import { CreatorProfileController } from './creator-profile.controller';
import { CreatorProfileService } from './creator-profile.service';

@Module({
  controllers: [CreatorProfileController],
  providers: [CreatorProfileService],
  exports: [CreatorProfileService],
})
export class CreatorProfileModule {}