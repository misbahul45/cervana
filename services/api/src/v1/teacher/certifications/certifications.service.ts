import { Injectable } from '@nestjs/common';
import { errorHandler } from '@/common/lib/utils';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { Query } from '@/common/interfaces';
import { CertificationsRepo } from './certifications.repo';
import { CreateCertificationType, UpdateCertificationType } from './certifications.dto';

@Injectable()
export class CertificationsService {
  constructor(
    private readonly certificationsRepo:CertificationsRepo
  ){}

  create(values:CreateCertificationType) {
    return errorHandler(async()=>{
      const newApplication=await this.certificationsRepo.create(values)

      return{
        message:'Successfually created teacher application',
        data:newApplication
      }
    })
  }

  findAll(q:Query) {
    return errorHandler(async()=>{
      const result=await this.certificationsRepo.findAll(q)
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
      const application=await this.certificationsRepo.findOne('id', id)

      if(!application?.id){
        throw new AppError('Teacher application not found', 404, AppErrorCode.NOT_FOUND)
      }
      return{
        message:"Successfully retrieved teacher application",
        data:application
      }
    })
  }

  update(id: string, values:UpdateCertificationType) {
    return errorHandler(async()=>{
      const application=await this.certificationsRepo.findOne('id', id)

      if(!application?.id){
        throw new AppError('Teacher application not found', 404, AppErrorCode.NOT_FOUND)
      }
      await this.certificationsRepo.update(id, values)

      return {
        message:'Successfully updated teacher application',
        data:null
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const application=await this.certificationsRepo.findOne('id', id)

      if(!application?.id){
        throw new AppError('Teacher application not found', 404, AppErrorCode.NOT_FOUND)
      }
      await this.certificationsRepo.delete(id)

      return {
        message:'Successfully updated teacher application',
        data:null
      }
    })
  }
}
