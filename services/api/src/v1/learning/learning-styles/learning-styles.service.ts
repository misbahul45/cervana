import { Injectable } from '@nestjs/common';
import { CreateLearningStyleProfileType, UpdateLearningStyleProfileType } from './learning-styles.dto';
import { errorHandler } from '@/common/lib/utils';
import { LearningStylesRepo } from './learning-styles.repo';
import { Query } from '@/common/interfaces';
import { AppError, AppErrorCode } from '@/common/lib/error';

@Injectable()
export class LearningStylesService {
  constructor(
    private readonly learningStylesRepo:LearningStylesRepo
  ){}
  create(values:CreateLearningStyleProfileType) {
    return errorHandler(async()=>{
      const newStyle=await this.learningStylesRepo.create(values)

      return{
        message:'Successfully created new style pofile',
        data:newStyle
      }
    })
  }


  findOne(id: string, q:Query) {
    return errorHandler(async()=>{
      const learningStyleProfile=await this.learningStylesRepo.findOne('id', id, q)

      if(!learningStyleProfile){
        throw new AppError('learning style profile not found',404, AppErrorCode.NOT_FOUND)
      }

      return{
        message:'Successfully retrieved',
        data:learningStyleProfile
      }
    })
  }

  update(id: string, values:UpdateLearningStyleProfileType) {
    return errorHandler(async()=>{
      const findStyle=await this.learningStylesRepo.findOne('id', id)
      
      if(!findStyle){
        throw new AppError('learning style not found', 404, AppErrorCode.NOT_FOUND)
      }

      await this.learningStylesRepo.update(id, values)

      return {
        message:'Successfully updated learning style',
        data:null
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const findStyle=await this.learningStylesRepo.findOne('id', id)
      
      if(!findStyle){
        throw new AppError('learning style not found', 404, AppErrorCode.NOT_FOUND)
      }

      await this.learningStylesRepo.delete(id)

      return {
        message:'Successfully deleted learning style',
        data:null
      }
    })
  }
}
