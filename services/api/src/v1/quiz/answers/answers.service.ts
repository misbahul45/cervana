import { Injectable } from '@nestjs/common';
import { CreateAnswerType } from './answers.dto';
import { errorHandler } from '@/common/lib/utils';
import { AppError } from '@/common/lib/error';
import { AnswersRepo } from './answers.repo';

@Injectable()
export class AnswersService {
  constructor(
    private readonly answersRepo:AnswersRepo
  ){}

  create(values: CreateAnswerType) {
    return errorHandler(async()=>{
      const newAnswer=await this.answersRepo.create(values)
      return{
        message:'Succcessfully create answer',
        data:newAnswer
      }
    })
  }

  findOne(id: string) {
    return errorHandler(async()=>{
      const answer=await this.answersRepo.findOne('id', id)

      return {
        message:'Sucessfully retrieved answer',
        data:answer
      }
    })
  }

  update(id: string, _values: unknown) {
    return errorHandler(async()=>{
      throw new AppError('Answer update is not supported; submit the attempt via POST /quiz-attempts/:id/submit', 405)
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const answer=await this.answersRepo.delete(id)

      if(!answer?.id){
        throw new AppError('answer not found', 404)
      }

      return {
        message:'Successfully delete answer',
        data:null
      }
    })
  }
}
