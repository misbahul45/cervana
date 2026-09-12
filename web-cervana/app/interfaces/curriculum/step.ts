import type { Theme } from '../theme'
import type { Resource } from '../resources'
import type { Quiz } from '../quiz'
import type { Chat } from '../chat'
import type { BaseLesson } from './lessons'
import type { UserStep } from '../learning/userSteps'
import type { PaginationMeta } from '../api'

export interface BaseStep {
  id: string
  title: string
  description?: string | null
  sortOrder: number

  lessonId: string
  themeId: string

  createdAt: Date | string
  updatedAt: Date | string

  // Count data jika kamu sering ambil aggregator
  userStepsCount: number
  resourcesCount: number
}

export interface StepDetailResponse<
  IncludeRelations extends boolean = false
> extends BaseStep {
  lesson?: IncludeRelations extends true ? BaseLesson : null
  theme?: IncludeRelations extends true ? Theme | null : null

  quiz?: IncludeRelations extends true ? Quiz | null : null
  chat?: IncludeRelations extends true ? Chat | null : null

  userSteps?: IncludeRelations extends true ? UserStep[] : null
  resources?: IncludeRelations extends true ? Resource[] : null
}

export interface StepsListResponse<
  IncludeRelations extends boolean = false
> {
  data: (IncludeRelations extends true
    ? StepDetailResponse<true>
    : BaseStep)[]
  pagination: PaginationMeta
}


export interface StepsListResponse<
  IncludeRelations extends boolean = false
> {
  data: (IncludeRelations extends true
    ? StepDetailResponse<true>
    : BaseStep)[]
  pagination: PaginationMeta
}
