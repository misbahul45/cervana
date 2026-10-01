import { Query } from '@/common/interfaces';
import { Injectable } from '@nestjs/common';
import { CreateSubTopicType, UpdateSubTopicType } from './subtopics.dto';
import { errorHandler } from '@/common/lib/utils';
import { AppError } from '@/common/lib/error';
import { SubTopicsRepo } from './sub-topics.repo';
import { LessonsRepo } from '../lessons/lessons.repo';

@Injectable()
export class SubtopicsService {
  constructor(
    private readonly subTopicsRepo:SubTopicsRepo,
    private readonly lessonsRepo:LessonsRepo
  ){}
  findAll(q:Query){
    return errorHandler(async()=>{
      const result=await this.subTopicsRepo.findAll(q)
      return{
        message:'Successfully retrieved subTopic',
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

  findNavigation(id: string, userId?: string) {
    return errorHandler(async () => {
      const data = await this.subTopicsRepo.findOneWithNavigation(id, userId)
      return {
        data,
        message: 'Successfully get navigation subTopic (previous, current, next)'
      }
    })
  }

  
  create(values: CreateSubTopicType) {
    return errorHandler(async()=>{
      const newSubTopic=await this.subTopicsRepo.create(values)

      return{
        message:'Successfully create subTopic',
        data:newSubTopic
      }
    })
  }
  findAllLessons(
    id:string,
    q:Query
  ){
    return errorHandler(async()=>{
      const result=await this.lessonsRepo.findAllBySubTopic(id, q)
      return{
        message:'Successfully retrieved lessons',
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

  async findOne(id: string, q:Query) {
    return errorHandler(async()=>{
      const subTopic=await this.subTopicsRepo.findOne('id', id, q)

      if(!subTopic?.id){
        throw new AppError('SubTopic not found', 404)
      }
      return {
        message:'Successfully retrieved subTopic',
        data:subTopic
      }
    })
  }

  update(id: string, values: UpdateSubTopicType) {
    return errorHandler(async()=>{
      const isExist=await this.subTopicsRepo.findOne('id', id)

      if(!isExist?.id){
        throw new AppError('SubTopic not found', 404)
      }

      await this.subTopicsRepo.update(id, values)

      return{
        message:'Successfully update subTopic',
        data:null
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
        const isExist=await this.subTopicsRepo.findOne('id', id)

        if(!isExist?.id){
          throw new AppError('SubTopic not found', 404)
        }

        return{
          message:'Successfully delete subTopic',
          data:null
        }
    })
  }
}
