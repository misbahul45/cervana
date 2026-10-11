import { Injectable } from '@nestjs/common';
import { CreateLessonType, UpdateLessonType } from './lessons.dto';
import { Query } from '@/common/interfaces';
import { errorHandler } from '@/common/lib/utils';
import { AppError } from '@/common/lib/error';
import { LessonsRepo } from './lessons.repo';
import { StepsRepo } from '../steps/steps.repo';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { neighboursOf } from './lesson-neighbours';

@Injectable()
export class LessonsService {
  constructor(
    private readonly lessonsRepo : LessonsRepo,
    private readonly stepsRepo:StepsRepo,
    private readonly prisma: PrismaService,
  ){}

  create(values: CreateLessonType) {
    return errorHandler(async()=>{
      const newLesson=await this.lessonsRepo.create(values)
      return{
        message:'Successfully create lesson',
        data:newLesson
      }
    })
  }

  findOne(id: string, q:Query) {
    return errorHandler(async()=>{
      const lesson=await this.lessonsRepo.findOne('id', id, q)
      if(!lesson?.id){
        throw new AppError('Lesson not found', 404)
      }
      return {
        message:'Sucessfully retrieved lesson',
        data:lesson
      }
    })
  }

  neighbours(userId: string, id: string) {
    return errorHandler(async()=>{
      const select = { id: true, title: true, description: true, sortOrder: true, subTopicId: true } as const
      const current = await this.prisma.lesson.findUnique({ where: { id }, select })
      if(!current){
        throw new AppError('Lesson not found', 404)
      }
      const siblings = await this.prisma.lesson.findMany({
        where: { subTopicId: current.subTopicId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select,
      })
      const around = neighboursOf(siblings, id)
      const wanted = [id, around?.previous?.id, around?.next?.id].filter((value): value is string => Boolean(value))
      const finished = await this.prisma.lessonProgress.findMany({
        where: { userId, lessonId: { in: wanted }, isDone: true },
        select: { lessonId: true },
      })
      const done = new Set(finished.map((row) => row.lessonId))
      return {
        message:'Sucessfully retrieved lesson neighbours',
        data:{
          current,
          previous: around?.previous ? { ...around.previous, completed: done.has(around.previous.id) } : null,
          next: around?.next ? { ...around.next, unlocked: done.has(id) } : null,
        }
      }
    })
  }

  update(id: string,values: UpdateLessonType) {
    return errorHandler(async()=>{
      const lesson=await this.lessonsRepo.findOne('id', id)

      if(!lesson?.id){
        throw new AppError('Lesson not found', 404)
      }

      await this.lessonsRepo.update(id, values)

      return{
        message:'Successfully update lesson',
        data:null
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const lesson=await this.lessonsRepo.findOne('id', id)
      if(!lesson?.id){
        throw new AppError('Lesson not found', 404)
      }
      await this.lessonsRepo.delete(id)
      return{
        message:'Successfully update lesson',
        data:null
      }
    })
  }
}
