import { Injectable } from '@nestjs/common';
import { UpdateLessonProgressType, CreateLessonProgressType } from './lesson-progresses.dto'
import { Query } from '@/common/interfaces';
import { errorHandler } from '@/common/lib/utils';
import { AppError } from '@/common/lib/error';
import { LessonProgressesRepo } from './lesson-progresses.repo';

@Injectable()
export class LessonProgressesService {
  constructor(
    private readonly lessonProgressesRepo:LessonProgressesRepo
  ){}
  create(values: CreateLessonProgressType) {
    return errorHandler(async()=>{
      const newLessonProgress=await this.lessonProgressesRepo.create(values)

      return{
        message:'Successfully create new lesson Progress',
        data:newLessonProgress
      }
    })
  }

  findAll(userId:string, q:Query) {
    return errorHandler(async()=>{
      const result=await this.lessonProgressesRepo.findAllByUserId(userId,q)
      return{
        message:'Successfully retrieved lesson Progres',
        data:{
          data:result.data,
          pagination: {
            page: result.meta.page,
            limit: result.meta.limit,
            total: result.meta.total,
            totalPages: result.meta.totalPages
          }
        }
      }
    })
  }

  findOne(id: string, q:Query) {
    return errorHandler(async()=>{
      const lessonProgress=await this.lessonProgressesRepo.findOne('id', id, q)

      if(!lessonProgress?.id){
        throw new AppError('Lesson Progress not found', 404)
      }

      return{
        message:'Successfully retrieved lesson progres',
        data:lessonProgress
      }
    })
  }

  update(id: string, values: UpdateLessonProgressType) {
    return errorHandler(async()=>{
      const updateLessonProgress=await this.lessonProgressesRepo.update(id, values)

      if(!updateLessonProgress.id){
        throw new AppError('Lesson Progress not found', 404)
      }

      return{
        message:'Successfully updated lesson progres',
        data:null
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const removeLessonProgres=await this.lessonProgressesRepo.delete(id)

      if(!removeLessonProgres.id){
        throw new AppError('Lesson Progress not found', 404)
      }

      return{
        message:'Successfully deleted lesson progress',
        data:null
      }
    })
  }
}
