import { Injectable } from '@nestjs/common';
import { CreateQuizType, UpdateQuizType } from './Quizzes.dto';
import { errorHandler } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';
import { AppError } from '@/common/lib/error';
import { QuizAttemptsRepo } from '../quiz-attempts/quiz-attempts.repo';
import { QuestionsRepo } from '../questions/questions.repo';
import { QuizzesRepo } from './quizzes.repo';

@Injectable()
export class QuizzesService {
  constructor(
    private readonly quizzessRepo:QuizzesRepo,
    private readonly quizAttemptsRepo:QuizAttemptsRepo,
    private readonly questionsRepo:QuestionsRepo
  ){}

  create(values:CreateQuizType ) {
    return errorHandler(async()=>{
      const newQuiz=await this.quizzessRepo.create(values)

      return{
        message:'Successfully created quiz',
        data:newQuiz
      }
    })
  }

  findAll(q:Query) {
    return errorHandler(async()=>{
      const result=await this.quizzessRepo.findAll(q)
      return{
        message:'Successfully retrieved quizs',
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
  findAllQuizAttempts(quizId:string, q:Query){
    return errorHandler(async()=>{
      const result=await this.quizAttemptsRepo.findAll(quizId,q)
      return{
        message:'Successfully retrieved quiz attempts',
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

  findAllQuestions(quizId:string, q:Query){
    return errorHandler(async()=>{
      const result=await this.questionsRepo.findAll(quizId, q)
      return{
        message:'Successfully retrieved quiz attempts',
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
      const quiz=await this.quizzessRepo.findOne('id', id, q)

      if(!quiz?.id){
        throw new AppError('Quiz not found', 404)
      }
      return{
        message:'Successfully retrieved quiz',
        data:quiz
      }
    })
  }

  update(id: string, values: UpdateQuizType) {
    return errorHandler(async()=>{
      const updatedQuiz=await this.quizzessRepo.update(id, values)

      if(!updatedQuiz?.id){
        throw new AppError('Quiz not found', 404)
      }

      return{
        message:'Successfullly update quiz',
        data:null
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const deleteQuiz=await this.quizzessRepo.delete(id)

      if(!deleteQuiz?.id){
        throw new AppError('Quiz not found', 404)
      }

      return{
        message:'Successfully updated quiz',
        data:null
      }
    })
  }
}
