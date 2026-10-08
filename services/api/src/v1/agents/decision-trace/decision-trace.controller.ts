import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { DecisionTraceService } from './decision-trace.service';

@Controller('agents/decision-trace')
@UseGuards(JwtAuthGuard)
export class DecisionTraceController {
  constructor(private readonly traces: DecisionTraceService) {}

  @Get('me')
  @Roles(Role.STUDENT, Role.TEACHER, Role.REVIEWER, Role.ADMIN)
  async me(@GetUser('id') userId: string) {
    return this.traces.listByUser(userId);
  }

  @Post('record')
  @Roles(Role.STUDENT, Role.TEACHER, Role.REVIEWER, Role.ADMIN)
  async record(
    @GetUser('id') userId: string,
    @Body()
    body: {
      agentName: string;
      agentScope: 'TUTOR' | 'CURRICULUM' | 'ASSESSMENT' | 'CREATOR_ASSISTANT' | 'CAREER';
      promptHash: string;
      responseHash: string;
      toolCalls: Array<{ name: string; endpoint: string; result: unknown }>;
      deterministicOutputs: Record<string, unknown>;
      ownershipCheckouts?: Array<{ endpoint: string; result: 'allow' | 'deny' }>;
    },
  ) {
    return this.traces.record({ userId, ...body });
  }
}