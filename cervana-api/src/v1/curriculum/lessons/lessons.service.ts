import { Injectable } from '@nestjs/common';
import { CreateLessonType, UpdateLessonType } from './lessons.dto';
import { Query } from '@/common/interfaces';
import { errorHandler } from '@/common/lib/utils';
import { AppError } from '@/common/lib/error';
import { LessonsRepo } from './lessons.repo';
import { StepsRepo } from '../steps/steps.repo';

@Injectable()
export class LessonsService {
  constructor(
    private readonly lessonsRepo : LessonsRepo,
    private readonly stepsRepo:StepsRepo 
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
