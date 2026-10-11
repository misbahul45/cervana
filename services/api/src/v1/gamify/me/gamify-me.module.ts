import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { GamifyMeController } from './gamify-me.controller';
import { GamifyMeService } from './gamify-me.service';

@Module({
  imports: [PrismaModule],
  controllers: [GamifyMeController],
  providers: [GamifyMeService],
  exports: [GamifyMeService],
})
export class GamifyMeModule {}
