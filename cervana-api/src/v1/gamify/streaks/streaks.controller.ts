import { Controller, Get, Delete, Query, Param } from '@nestjs/common';
import { StreaksService } from './streaks.service';
import { Query as QueryInterface } from '@/common/interfaces';
import { GetUser } from '@/v1/auth/auth.decorator';
import { User } from '@prisma/client';

@Controller('streaks')
export class StreaksController {
  constructor(private readonly streaksService: StreaksService) {}

  @Get()
  findAll(@Query() q:QueryInterface) {
    if (q.userId) {
      return this.streaksService.findByUser(q.userId);
    }
    return this.streaksService.findAll(q);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.streaksService.remove(id);
  }

  @Get('/latest')
  findLatestStreak(@GetUser() user:User) {
    return this.streaksService.findByUser(user.id, { page: 1, limit: 1 });
  }
}
