import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req } from '@nestjs/common';
import { PersonalityQuizzesService } from './personality-quizzes.service';
import { CreatePersonalityQuizType, PersonalityQuizUserAttemptSchema, UpdatePersonalityQuizType } from './personality-quizzes.dto';
import { PersonalityQuizSseService } from '@/v1/sse/personality-quiz-sse/personality-quiz-sse.service';
import { GetUser } from '@/v1/auth/auth.decorator';
import { Query as QueryInterface } from '@/common/interfaces';
import z from 'zod';
import { User } from '@prisma/client';

@Controller('personality-quizzes')
export class PersonalityQuizzesController {
  constructor(
    private readonly personalityQuizzesService: PersonalityQuizzesService,
    private readonly personalityQuizzesSseService: PersonalityQuizSseService
  ) {}

  @Post()
  async create(
    @Body() values: CreatePersonalityQuizType,
    @GetUser() user: User
  ) {
    const res = await this.personalityQuizzesService.create(values);
    this.personalityQuizzesSseService.emitUpdate({
      userId: user.id,
      personalityQuizId: res.data.id,
    });
    return res;
  }

  @Patch('/submit/:id')
  async submitAttempt(
    @Query() query:{
      topicId: string
      lessonId: string
      learningStyleId: string
    },
    @Param('id') id:string,
    @GetUser() user:User,
    @Body() values:z.infer<typeof PersonalityQuizUserAttemptSchema>,
    @Req() req
  ){
    const token =
    req.cookies?.access_token ||
    req.headers.authorization?.replace('Bearer ', '');
    
    return this.personalityQuizzesService.submitAttempt({
      ...query,
      userId:user.id,
      token,
      quizId:id
    }, values)
  }

  @Get()
  findAll(
    @GetUser() user: User,
    @Query() query: QueryInterface
  ) {
    return this.personalityQuizzesService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query() q: any) {
    return this.personalityQuizzesService.findOne(id, q);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() values: UpdatePersonalityQuizType
  ) {
    return this.personalityQuizzesService.update(id, values);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.personalityQuizzesService.remove(id);
  }
}
