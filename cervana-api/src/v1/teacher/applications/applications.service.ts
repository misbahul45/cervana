import { Injectable } from '@nestjs/common';
import { CreateTeacherApplicationType, UpdateTeacherApplicationType } from './applications.dto';
import { errorHandler } from '@/common/lib/utils';
import { ApplicationsRepo } from './applications.repo';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { Query } from '@/common/interfaces';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly applicationsRepo:ApplicationsRepo
  ){}

  create(values:CreateTeacherApplicationType) {
    return errorHandler(async()=>{
      const application=await this.applicationsRepo.findOne('userId', values.userId)

      if(application){
        throw new AppError('Teacher application has already created', 4400, AppErrorCode.UNIQUE_CONSTRAINT_FAILED)
      }
      const newApplication=await this.applicationsRepo.create(values)

      return{
        message:'Successfually created teacher application',
        data:newApplication
      }
    })
  }

  findAll(q:Query) {
    return errorHandler(async()=>{
      const result=await this.applicationsRepo.findAll(q)
      return{
        message:'Successfully retrieved teacher applications',
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

  findOne(id: string) {
    return errorHandler(async()=>{
      const application=await this.applicationsRepo.findOne('id', id)

      if(!application?.id){
        throw new AppError('Teacher application not found', 404, AppErrorCode.NOT_FOUND)
      }
      return{
        message:"Successfully retrieved teacher application",
        data:application
      }
    })
  }

  update(id: string, values:UpdateTeacherApplicationType) {
    return errorHandler(async()=>{
      const application=await this.applicationsRepo.findOne('id', id)

      if(!application?.id){
        throw new AppError('Teacher application not found', 404, AppErrorCode.NOT_FOUND)
      }
      await this.applicationsRepo.update(id, values)

      return {
        message:'Successfully updated teacher application',
        data:null
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const application=await this.applicationsRepo.findOne('id', id)

      if(!application?.id){
        throw new AppError('Teacher application not found', 404, AppErrorCode.NOT_FOUND)
      }
      await this.applicationsRepo.delete(id)

      return {
        message:'Successfully updated teacher application',
        data:null
      }
    })
  }
}
