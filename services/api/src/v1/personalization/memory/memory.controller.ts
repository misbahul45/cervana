import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { MemoryService } from './memory.service';

@Controller('v1/personalization/memory')
@UseGuards(JwtAuthGuard)
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Get()
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async list(
    @GetUser('id') userId: string,
    @Query('lessonId') lessonId?: string,
    @Query('allowCrossLesson') allowCrossLesson?: string,
  ) {
    if (lessonId) {
      return this.memory.listForLesson({
        userId,
        lessonId,
        kind: 'SHORT_TERM',
        allowCrossLesson: allowCrossLesson === 'true',
      });
    }
    return this.memory.listLongTermProfile(userId);
  }

  @Post()
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async record(
    @GetUser('id') userId: string,
    @Body() body: { lessonId?: string; kind: 'SHORT_TERM' | 'LONG_TERM_PROFILE' | 'LONG_TERM_MISCONCEPTION'; payload: unknown },
  ) {
    return this.memory.record({
      userId,
      lessonId: body.lessonId,
      kind: body.kind ?? 'SHORT_TERM',
      payload: body.payload,
    });
  }

  @Post('distill')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async distill(@GetUser('id') userId: string) {
    return this.memory.distillProfile(userId);
  }
}