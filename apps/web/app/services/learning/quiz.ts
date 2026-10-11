import type { AssessmentGamify } from "~/interfaces/gamify"
import { request } from "~/lib/api"
import type { QuestionRow } from "~/lib/quiz"

export interface QuizSummary {
  id: string
  title: string
  passingScore?: number
}

export interface QuizAttemptRow {
  id: string
  quizId: string
  attemptNumber: number
  status: string
}

export interface QuizSubmitResult {
  isCorrect: Record<string, boolean>
  score: number
  gamify?: AssessmentGamify
}

export const quizService = {
  async findOne(quizId: string) {
    return request<QuizSummary>(`/quiz/quizs/${quizId}`, "GET")
  },

  async questions(quizId: string) {
    return request<{ data: QuestionRow[]; pagination: unknown }>(`/quiz/quizs/${quizId}/questions?limit=100`, "GET")
  },

  async startAttempt(quizId: string) {
    return request<QuizAttemptRow>("/quiz/quiz-attempts/start", "POST", { quizId })
  },

  async submitAttempt(attemptId: string, body: { answers: Record<string, string>; hintUsed?: boolean }) {
    return request<QuizSubmitResult>(`/quiz/quiz-attempts/${attemptId}/submit`, "POST", body)
  },
}
