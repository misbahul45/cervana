import { Module } from '@nestjs/common';
import { ThemesService } from './themes.service';
import { ThemesController } from './themes.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { ThemesRepo } from './themes.repo';

@Module({
  controllers: [ThemesController],
  providers: [ThemesService, ThemesRepo],
  imports: [PrismaModule],
  exports: [ThemesService, ThemesRepo]
})
export class ThemeModule {}
