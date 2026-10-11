import { Query } from '@/common/interfaces';
import { errorHandler, slugify } from '@/common/lib/utils';
import { Injectable } from '@nestjs/common';
import { CreateTopicType, UpdateTopicType } from './topics.dto';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { TopicsRepo } from './topics.repo';
import { SubTopicsRepo } from '../subtopics/sub-topics.repo';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TopicsService {
  constructor(
    private readonly topicsRepo:TopicsRepo,
    private readonly subTopicsRepo:SubTopicsRepo
  ){}

  create(values: CreateTopicType) {
    return errorHandler(async () => {
      const newTopic = await this.topicsRepo.create({
        ...values,
        slug: slugify(values.title),
      });

      return {
        message: 'Successfully created topic',
        data: newTopic,
      };
    });
  }

  findAll(q:Query) {
    return errorHandler(async()=>{
      const result=await this.topicsRepo.findAll(q)

      return{
        message:'Successfully retrieved Topics',
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


  findOne(identifier: string, q:Query) {
    return errorHandler(async()=>{
        const key = UUID_PATTERN.test(identifier) ? 'id' : 'slug'
        const topic=await this.topicsRepo.findOne(key, identifier, q)

        if(!topic?.id){
          throw new AppError('Topic not found', 404, AppErrorCode.NOT_FOUND)
        }
        return {
          message:'Sucessfully retrieved topic',
          data:topic
        }
    })
  }


  update(id: string, values: UpdateTopicType) {
    return errorHandler(async()=>{
      const isExist=await this.topicsRepo.findOne('id', id)
      
      if(!isExist){
        throw new AppError('Topic not found', 404)
      }

      await this.topicsRepo.update(id, values)
      
      return{
        message:'Successfully update topic',
        data:null
      }
    })
  }

  remove(id: string ) {
    return errorHandler(async()=>{
      const isExist=await this.topicsRepo.findOne('id', id)
      
      if(!isExist){
        throw new AppError('Topic not found', 404)
      }

      return{
        message:'Successfully delete topic',
        data:null
      }
      
    })
  }
}
