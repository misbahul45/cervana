import { Injectable } from '@nestjs/common';
import { CreateQuestionType, UpdateQuestionType } from './questions.dto';
import { errorHandler } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';
import { AppError } from '@/common/lib/error';
import { QuestionsRepo } from './questions.repo';


@Injectable()
export class QuestionsService {
  constructor(
    private readonly questionService:QuestionsRepo
  ){}
  create(values: CreateQuestionType) {
    return errorHandler(async()=>{
      const newQuestion=await this.questionService.create(values)
      return{
        message:'Successfully created question',
        data:newQuestion
      }
    })
  }

  findOne(id: string, q:Query) {
    return errorHandler(async()=>{
      const question=await this.questionService.findOne('id', id, q)

      if(!question?.id){
        throw new AppError('Question not found', 404)
      }

      return {
        message:'Successfully retrieved question',
        data:question
      }
    })
  }

  update(id: string, values: UpdateQuestionType) {
    return errorHandler(async()=>{
      const updateQuestion=await this.questionService.update(id, values)

      if(!updateQuestion?.id){
        throw new AppError('Question not found', 404)
      }

      return {
        message:'Successfully update question',
        data:null
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const deleteQuestion=await this.questionService.delete(id)

      if(!deleteQuestion?.id){
        throw new AppError('Question not found', 404)
      }

      return {
        message:'Successfully delete question',
        data:null
      }
    })
  }
}
