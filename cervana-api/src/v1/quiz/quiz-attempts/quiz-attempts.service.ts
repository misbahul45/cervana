import { Injectable } from '@nestjs/common';
import { CreateQuizAttemptType, UpdateQuizAttemptType } from './quizAttempets.dto';
import { errorHandler } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';
import { AppError } from '@/common/lib/error';
import { QuizAttemptsRepo } from './quiz-attempts.repo';


@Injectable()
export class QuizAttemptsService {
  constructor(
    private readonly quizAttempetsRepo:QuizAttemptsRepo
  ){}
  create(values: CreateQuizAttemptType) {
    return errorHandler(async()=>{
      const newQuizAttempt=await this.quizAttempetsRepo.create(values)

      return {
        message:'Successfully created quizAttempt',
        data:newQuizAttempt
      }
    })
  }

  findOne(id: string, q:Query) {
    return errorHandler(async()=>{
      const quizAttempet=await this.quizAttempetsRepo.findOne('id', id, q)

      if(!quizAttempet?.id){
        throw new AppError('Quiz attempt not found', 404)
      }

      return {
        message:'Successfully retrieved quiz attempt',
        data:quizAttempet
      }
    })
  }

  update(id: string, values: UpdateQuizAttemptType) {
    return errorHandler(async()=>{
      const updateQuizAttempt=await this.quizAttempetsRepo.update(id, values)

      if(!updateQuizAttempt.id){
        throw new AppError('Quiz attempt not found', 404)
      }

      return{
        message:'Successfully update quiz attempt',
        data:null
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const deleteQuizAttempt=await this.quizAttempetsRepo.delete(id)

      if(!deleteQuizAttempt?.id){
        throw new AppError('Quiz attempt not found', 404)
      }
      return{
        message:'Successfully delete quiz attempt',
        data:null
      }
    })
  }

  findAllAnswer(quizAttemptId:string, q:Query){
    return errorHandler(async()=>{
      const result=await this.quizAttempetsRepo.findAll(quizAttemptId, q)
      return{
        message:'Successfully retrieved answers',
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
}
