import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { UsersRepo } from './users.repo';

@Module({
  imports: [
    PrismaModule
  ],
  controllers: [
    UsersController,
  ],
  providers: [UsersService, UsersRepo],
  exports: [UsersService, UsersRepo]
})
export class UsersModule { }
