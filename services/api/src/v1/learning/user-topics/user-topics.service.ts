import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor, PolicyService } from '@/common/authz/policy.service';
import { AppErrorCode } from '@/common/lib/error';
import {
  CreateUserTopicType,
  EnrollUserTopicDto,
  UpdateLearnerProgressDto,
  UpdateUserTopicType,
} from './userTopics.dto';
import { errorHandler } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';
import { AppError } from '@/common/lib/error';
import { UserTopicsRepo } from './user-topics.repo';


@Injectable()
export class UserTopicsService {
  constructor(
    private readonly userTopicService:UserTopicsRepo,
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
  ){}

  enroll(actor: Actor, values: unknown) {
    if (this.policy.isAdmin(actor)) {
      return this.create(values as CreateUserTopicType);
    }
    return errorHandler(async()=>{
      if (Array.isArray(values)) {
        throw new AppError('Bulk enrollment is not permitted', 400, AppErrorCode.VALIDATION_ERROR)
      }
      const input = EnrollUserTopicDto.parse(values)
      const topic = await this.prisma.topic.findUnique({
        where: { id: input.topicId },
        select: { id: true, price: true },
      })
      if (!topic) {
        throw new AppError('Topic not found', 404, AppErrorCode.NOT_FOUND)
      }
      if (topic.price && topic.price > 0) {
        throw new AppError('Purchase required to access this topic', 403, AppErrorCode.FORBIDDEN)
      }
      const newUserTopic = await this.userTopicService.create({
        userId: actor.id,
        topicId: input.topicId,
        accessType: 'FREE',
        status: 'NOT_STARTED',
        progressPercent: 0,
      })
      return{
        message:'Successfully created userTopic',
        data:newUserTopic
      }
    })
  }

  updateAs(actor: Actor, id: string, values: unknown) {
    if (this.policy.isAdmin(actor)) {
      return this.update(id, values as UpdateUserTopicType);
    }
    return this.update(id, UpdateLearnerProgressDto.parse(values) as UpdateUserTopicType);
  }

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
