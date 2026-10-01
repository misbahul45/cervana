import type { PaginationMeta } from '../api'
import type { Resource } from '../resources'
import type { Theme } from '../theme'
import type { BaseStep } from './step'
import type { BaseSubTopic } from './subTopics'

// Base lesson minimal
export interface BaseLesson {
  id: string
  title: string
  description?: string | null
  sortOrder?: number
  subTopicId: string
  subTopic?: BaseSubTopic | null
  steps?: BaseStep[] | null
  resources?: Resource[] | null
  themeId?: string | null
  theme?: Theme | null
  createdAt: Date | string
  updatedAt: Date | string
}

// Detail response untuk satu lesson
export interface LessonDetailResponse<IncludeRelations extends boolean = false> extends BaseLesson {
  steps?: IncludeRelations extends true ? BaseStep[] : undefined
  resources?: IncludeRelations extends true ? Resource[] : undefined
  theme?: IncludeRelations extends true ? Theme : undefined
  subTopic?: IncludeRelations extends true ? BaseSubTopic : undefined
}

// Response list dengan pagination
export interface LessonsListResponse<IncludeRelations extends boolean = false> {
  data: (IncludeRelations extends true
    ? LessonDetailResponse<true>
    : LessonDetailResponse<false>)[]
  pagination: PaginationMeta
}
export interface PrevLessonResponse<IncludeRelations extends boolean = false> {
  current: LessonDetailResponse<IncludeRelations> | null
  previous: (LessonDetailResponse<IncludeRelations> & {
    completed: boolean
  }) | null
}

export interface NextLessonResponse<IncludeRelations extends boolean = false> {
  current: LessonDetailResponse<IncludeRelations> | null
  next: (LessonDetailResponse<IncludeRelations> & {
    unlocked: boolean
  }) | null
}


// Current lesson response (optional, untuk panggil tunggal)
export interface CurrentLessonResponse<IncludeRelations extends boolean = false> {
  current: LessonDetailResponse<IncludeRelations> | null
}
