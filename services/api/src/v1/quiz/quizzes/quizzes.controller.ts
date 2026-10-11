import { RequireOwnership } from '@/v1/common/guards/ownership.decorator';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { forViewer, viewerQuery } from '../answer-key';
import { QuizAccessService } from '../quiz-access.service';
import { Role } from '@prisma/client';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { CreateQuizType, UpdateQuizType } from './Quizzes.dto';
import { Query as QueryInterface } from '@/common/interfaces';
@Controller('quizs')
export class QuizzesController {
  constructor(
    private readonly quizsService: QuizzesService,
    private readonly access: QuizAccessService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.TEACHER)
  create(@Body() createQuizDto: CreateQuizType) {
    return this.quizsService.create(createQuizDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TEACHER)
  findAll(
    @Query() query:QueryInterface  
  ) {
    return this.quizsService.findAll(query);
  }

  @Get(':id')
  @RequireOwnership('quiz', { allowUnownedRead: true })
  async findOne(
    @Param('id') id: string,
    @Query() query:QueryInterface,
    @GetUser() user: AuthUser,
  ) {
    await this.access.assertCanTake(user, id);
    return forViewer(user?.role, await this.quizsService.findOne(id, viewerQuery(user?.role, query)));
  }

  @Get(':id/quiz-attempts')
  @RequireOwnership('quiz')
  findAllQuizAttempts(
    @Param('id') id:string,
    @Query() query:QueryInterface
  ){
    return this.quizsService.findAllQuizAttempts(id, query)
  }

  @Get(':id/questions')
  @RequireOwnership('quiz', { allowUnownedRead: true })
  async findAllQuestions(
    @Param('id') id:string,
    @Query() query:QueryInterface,
    @GetUser() user: AuthUser,
  ){
    await this.access.assertCanTake(user, id);
    return forViewer(user?.role, await this.quizsService.findAllQuestions(id, query))
  }


  @Patch(':id')
  @Roles(Role.ADMIN, Role.TEACHER)
  update(@Param('id') id: string, @Body() updateQuizDto:UpdateQuizType ) {
    return this.quizsService.update(id, updateQuizDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.quizsService.remove(id);
  }
}
