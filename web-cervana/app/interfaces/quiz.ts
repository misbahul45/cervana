import type { BaseStep } from "./curriculum/step"

export interface Question {
  id: string
  quizId: string
  quiz?: Quiz | null
  question: string
  questionType?: 'MULTIPLE_CHOICE' | 'TEXT' | 'FILE_UPLOAD' | 'CASE_STUDY'
  options?: any | null
  correctAnswer?: any | null
  points?: number
  sortOrder?: number
  answers?: any[] | null
}

export interface QuizAttempt {
  id: string
  userId: string
  quizId: string
  quiz?: Quiz | null
  score?: number
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED'
  attemptNumber?: number
  answers?: any[] | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface Quiz {
  id: string
  title: string
  stepId: string
  step?: BaseStep | null
  passingScore?: number
  questions?: Question[] | null
  quizAttempts?: QuizAttempt[] | null
  createdAt: Date | string
  updatedAt: Date | string
}
