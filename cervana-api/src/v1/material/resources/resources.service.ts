import { Injectable } from '@nestjs/common';
import { CreateResourceType } from './resources.dto';
import { errorHandler } from '@/common/lib/utils';
import { ResourcesRepo } from './resources.repo';
import { Query } from '@/common/interfaces';
import { AppError } from '@/common/lib/error';
import { JOBSTATUSTYPE } from '@prisma/client';

@Injectable()
export class ResourcesService {
  constructor(private readonly resourcesRepo:ResourcesRepo){}
  create(data: CreateResourceType, token:string) {
    return  errorHandler(async()=>{
      const newResource=await this.resourcesRepo.create(data, token)

      return {
        message:"Successfully created resource",
        data:newResource
      }
    })
  }

  findAll(q:Query) {
    return errorHandler(async()=>{
      const result= await this.resourcesRepo.findAll(q)
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

  findOne(id: string) {
    return errorHandler(async()=>{
       const resource=await this.resourcesRepo.findOne('id', id)

       if(!resource){
        throw new AppError('Resource not found', 404)
       }

       return{
        message:'Sucessfully retrieved resource',
        data:resource
       }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const resource=await this.resourcesRepo.findOne('id', id)
      
      if(!resource){
        throw new AppError('Resource not found', 404)
       }
      
       await this.resourcesRepo.delete(id)

       return{
        message:'successfully deleted resource',
        data:null
       }
    })
  }

  callback(
    token:string,
    type: 'EMMBED' | 'EXTRACT',
    body: { resourceId: string; content?: string; status?: JOBSTATUSTYPE }
  ) {
    return errorHandler(async () => {
      const { resourceId, content } = body;
      const resource = await this.resourcesRepo.findOne('id', resourceId);
      if (!resource) throw new AppError('Resource not found', 404);

      await this.resourcesRepo.update(resourceId, {
        ...(body.content ? { content: content } : {}),
        ...(body.status ? { jobStatus: body.status } : {}),
        ...(type === 'EMMBED' || type =='EXTRACT'
          ? { isEmbedded: true, embeddingAt: new Date() }
          : {}),
      });


      return { message: 'Callback processed successfully', data: null };
    });
  }
}
