import { Injectable } from '@nestjs/common';
import { CreateStepType, UpdateStepType } from './steps.dto';
import { errorHandler } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';
import { AppError } from '@/common/lib/error';
import { StepsRepo } from './steps.repo';
import { ContentsRepo } from '@/v1/chat/contents/contents.repo';

@Injectable()
export class StepsService {
  constructor(
    private readonly stepsRepo:StepsRepo,
    private readonly contentsRepo:ContentsRepo,
  ){}
  create(userId:string, values:CreateStepType) {
    return errorHandler(async()=>{
      const newStep=await this.stepsRepo.create(values)

      if(!newStep?.id){
        throw new AppError('Failed to create')
      }
      return{
        message:'Successfully create step',
        data:newStep
      }
    })
  }


  findOne(id: string, q:Query) {
    return errorHandler(async()=>{
      const step=await this.stepsRepo.findOne('id', id)

      if(!step?.id){
        throw new AppError('Step not found', 404)
      }
      return {
        message:'Sucessfully retrieved step',
        data:step
      }
    })
  }

  update(id: string, values:UpdateStepType) {
    return errorHandler(async()=>{
      const step=await this.stepsRepo.findOne('id', id)

      if(!step?.id){
        throw new AppError('Step not found', 404)
      }
      await this.stepsRepo.update(id, values)
      return {
        message:'Sucessfully update step',
        data:null
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const step=await this.stepsRepo.findOne('id', id)

      if(!step?.id){
        throw new AppError('Step not found', 404)
      }
      await this.stepsRepo.delete(id)
      return {
        message:'Sucessfully delete step',
        data:null 
      }
    })
  }
  findAll(q:Query){
      return errorHandler(async()=>{
        const result=await this.stepsRepo.findAll(q)
        return{
          message:'Successfully retrieved steps',
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
}
