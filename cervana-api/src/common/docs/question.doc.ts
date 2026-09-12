import { extendApi } from '@anatine/zod-openapi'
import z from 'zod'

export const BaseQuestionSchema = z.object({
  id: z.string().describe('Unique question identifier'),
  quizId: z.string().describe('Parent quiz ID'),
  question: z.string().describe('The question text'),
  questionType: z.enum(['MULTIPLE_CHOICE', 'TEXT', 'FILE_UPLOAD', 'CASE_STUDY']).describe('Type of the question'),
  options: z.any().nullable().optional().describe('Available options for multiple choice (JSON format)'),
  correctAnswer: z.any().describe('Correct answer in JSON format'),
  points: z.number().int().describe('Points awarded for this question'),
  sortOrder: z.number().int().describe('Order of the question in the quiz'),
})

export const QuestionDetailSchema = extendApi(
  BaseQuestionSchema.extend({
    answers: z.array(
      z.object({
        id: z.string(),
        attemptId: z.string(),
        userAnswer: z.any(),
        isCorrect: z.boolean(),
        pointsEarned: z.number(),
      })
    ).optional().describe('List of answers submitted for this question'),
    _count: z.object({
      answers: z.number()
    }).optional().describe('Number of answers for this question'),
  }),
  {
    title: 'QuestionDetail',
    example: {
      id: 'question-uuid-1',
      quizId: 'quiz-uuid-123',
      question: 'What is the capital of France?',
      questionType: 'MULTIPLE_CHOICE',
      options: ['Paris', 'London', 'Berlin', 'Madrid'],
      correctAnswer: 'Paris',
      points: 5,
      sortOrder: 1,
      answers: [
        {
          id: 'answer-uuid-1',
          attemptId: 'attempt-uuid-123',
          userAnswer: 'Paris',
          isCorrect: true,
          pointsEarned: 5,
        }
      ],
      _count: {
        answers: 12
      }
    }
  }
)

export const QuestionListSchema = extendApi(
  z.object({
    data: z.array(BaseQuestionSchema.extend({
      _count: z.object({
        answers: z.number()
      }).optional().describe('Number of answers for this question')
    })).describe('List of questions'),
    pagination: z.object({
      page: z.number().describe('Current page number'),
      limit: z.number().describe('Items per page'),
      total: z.number().describe('Total number of questions'),
      totalPages: z.number().describe('Total number of pages'),
      hasNext: z.boolean().describe('Has next page'),
      hasPrev: z.boolean().describe('Has previous page'),
    }).describe('Pagination details')
  }),
  {
    title: 'QuestionsList',
    example: {
      data: [
        {
          id: 'question-uuid-1',
          quizId: 'quiz-uuid-123',
          question: 'What is the capital of France?',
          questionType: 'MULTIPLE_CHOICE',
          options: ['Paris', 'London', 'Berlin', 'Madrid'],
          correctAnswer: 'Paris',
          points: 5,
          sortOrder: 1,
          _count: { answers: 12 }
        }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 50,
        totalPages: 5,
        hasNext: true,
        hasPrev: false
      }
    }
  }
)
