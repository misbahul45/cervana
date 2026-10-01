import { Injectable } from '@nestjs/common';
import { CreateContentDtoType } from './contents.dto';
import { errorHandler } from '@/common/lib/utils';
import { AppError } from '@/common/lib/error';
import { ContentsRepo } from './contents.repo';
import { Query } from '@/common/interfaces';

@Injectable()
export class ContentsService {
  constructor(
    private readonly contentsRepo:ContentsRepo,
  ){}
  findAll(q:Query){
    return errorHandler(async()=>{
      const result=await this.contentsRepo.findAll(q)
      return {
        message: 'Successfully retrieved resources',
        data: {
          data: result.data,
          pagination: {
            page: result.meta.page,
            limit: result.meta.limit,
            total: result.meta.total,
            totalPages: result.meta.totalPages,
          },
        },
     }
    })
  }

  create(values: CreateContentDtoType) {
    return errorHandler(async()=>{
      const newContent=await this.contentsRepo.create(values)

      return {
        message:'Succsessfully create content',
        data:newContent
      }
    })
  }


  remove(id: string) {
    return errorHandler(async()=>{
      const isDeleted=await this.contentsRepo.delete(id)
      if(!isDeleted){
        throw new AppError('Content not found', 404)
      }

      return {
        message:'Succsessfully delete content',
        data:null    
      }
    })
  }

}
