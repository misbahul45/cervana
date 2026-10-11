import { BadRequestException, Body, Controller, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import { AuthenticatedOnly } from '@/common/authz/access';
import { GetUser } from '@/v1/auth/auth.decorator';
import { parseMembershipInput } from './board-rules';
import { TopicBoardService } from './topic-board.service';

const parseLimit = (raw?: string): number | undefined => {
  const value = Number(raw);
  return raw !== undefined && Number.isFinite(value) ? value : undefined;
};

@Controller('leaderboards')
export class TopicBoardController {
  constructor(private readonly boards: TopicBoardService) {}

  @Get('topics/:topicId')
  @AuthenticatedOnly()
  async topic(@Param('topicId') topicId: string, @GetUser('id') userId: string, @Query('limit') limit?: string) {
    return { message: 'Topic board', data: await this.boards.board(userId, topicId, { limit: parseLimit(limit) }) };
  }

  @Put('me')
  @AuthenticatedOnly()
  @HttpCode(200)
  async membership(@GetUser('id') userId: string, @Body() body: unknown) {
    const input = parseMembershipInput(body);
    if (!input) throw new BadRequestException('Send optIn (true or false) and/or a handle of 3 to 20 lowercase letters, digits or underscore');
    return { message: 'Board membership', data: await this.boards.updateMembership(userId, input) };
  }
}
