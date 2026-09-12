import type { PaginationMeta } from "../api"

export interface PersonalityQuizQuestion {
  question: string
  type: "multiple_choice" | "input" | "matching" | "scenario"
  difficulty: "easy" | "medium" | "hard" | "hots"
  options?: string[] | null
  answer?: string | null
}

export interface PersonalityQuizUserAttemptItem {
  question: string
  userAnswer: string
  answer?: string | null
}

export type PersonalityQuizUserAttempt =
  | PersonalityQuizUserAttemptItem[]
  | "JSON_NULL"

export interface PersonalityQuizResult {
  scores?: Record<string, number>
  overallScore?: number
  level?: "beginner" | "intermediate" | "advanced" | "expert"
  traitLabel?: string | null
  interpretation?: string | null
  recommendedSteps?: {
    stepId: string
    priority: number
  }[]
  skipSteps?: string[]
  rawAIOutput?: any
}

export type PersonalityQuizResultOrNull = PersonalityQuizResult | "JSON_NULL"

export interface PersonalityQuizBase {
  userId: string
  lessonId: string
  title: string
  questions: PersonalityQuizQuestion[]
  userAttempt?: PersonalityQuizUserAttempt
  result?: PersonalityQuizResultOrNull
  takenAt?: string | Date | null
}

export interface CreatePersonalityQuizDto {
  userId: string
  lessonId: string
  title: string
  questions: PersonalityQuizQuestion[]
  userAttempt?: PersonalityQuizUserAttempt
  result?: PersonalityQuizResultOrNull
  takenAt?: string | Date | null
}

export interface UpdatePersonalityQuizDto {
  userId?: string
  lessonId?: string
  title?: string
  questions?: PersonalityQuizQuestion[]
  userAttempt?: PersonalityQuizUserAttempt
  result?: PersonalityQuizResultOrNull
  takenAt?: string | Date | null
}

export interface PersonalityQuiz extends PersonalityQuizBase {
  id: string
}

export interface PersonalityQuizDetailResponse {
  data: PersonalityQuiz
}

export interface PersonalityQuizListResponse {
  data: PersonalityQuiz[]
  pagination: PaginationMeta
}
