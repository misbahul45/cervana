import { Controller, Get } from '@nestjs/common';
import { AuthenticatedOnly } from '@/common/authz/access';
import { GetUser } from '@/v1/auth/auth.decorator';
import { GamifyMeService } from './gamify-me.service';

@Controller('me')
export class GamifyMeController {
  constructor(private readonly me: GamifyMeService) {}

  @Get()
  @AuthenticatedOnly()
  async mine(@GetUser('id') userId: string) {
    return { message: 'Gamification state', data: await this.me.get(userId) };
  }
}
