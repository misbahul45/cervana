import { Injectable } from '@nestjs/common';
import { CreateUserTopicType, UpdateUserTopicType } from './userTopics.dto';
import { errorHandler } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';
import { AppError } from '@/common/lib/error';
import { UserTopicsRepo } from './user-topics.repo';


@Injectable()
export class UserTopicsService {
  constructor(
    private readonly userTopicService:UserTopicsRepo
  ){}

  create(values: CreateUserTopicType) {
    return errorHandler(async()=>{
      const newUserTopic=await this.userTopicService.create(values)
      return{
        message:'Successfully created userTopic',
        data:newUserTopic
      }
    })
  }

  findAll(userId:string, q:Query) {
    return errorHandler(async()=>{
      const result=await this.userTopicService.findAll(userId, q)
      return{
        message:'Successfully retrieved User Topic',
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
      const userTopic=await this.userTopicService.findOne('id', id, q)
      
      if(!userTopic?.id){
        throw new AppError('User topic not found')
      }

      return{
        message:'Successfully retrieved userTopic',
        ata:userTopic
      }
    })
  }

  update(id: string, values: UpdateUserTopicType) {
    return errorHandler(async()=>{
      const userTopicUpdate=await this.userTopicService.update(id, values)

      if(!userTopicUpdate.id){
        throw new AppError('User topic not found')
      }

      return{
        message:'Successfully updated userTopic',
        data:null
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const deleteUserTopic=await this.userTopicService.delete(id)
      
      if(!deleteUserTopic.id){
        throw new AppError('User topic not found')
      }

      return{
        message:'Successfully deleted userTopic',
        data:null
      }
    })
  }
}
