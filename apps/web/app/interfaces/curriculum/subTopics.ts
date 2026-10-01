import type { Resource } from '../resources'
import type { Theme } from '../theme'
import type { LeaderboardScore } from '../leaderboardScore'
import type { PaginationMeta } from '../api'
import type { BaseLesson } from './lessons'

export interface BaseSubTopic {
  id: string
  title: string
  description?: string | null
  sortOrder?: number
  topicId: string
  createdAt: Date | string
  updatedAt: Date | string

  isUnlocked:boolean;

  // relations
  _count?:{
    lessons:number
  }
  lessons?: BaseLesson[] | null
  resources?: Resource[] | null
  theme?: Theme | null
  leaderboardScores?: LeaderboardScore[] | null

}

export interface SubTopicDetailResponse<IncludeRelations extends boolean = false> extends BaseSubTopic {
  lessons?: IncludeRelations extends true ? BaseLesson[] : undefined
  resources?: IncludeRelations extends true ? Resource[] : undefined
  themes?: IncludeRelations extends true ? Theme : undefined
  leaderboardScores?: IncludeRelations extends true ? LeaderboardScore[] : undefined
}

export interface SubTopicsListResponse<IncludeRelations extends boolean = false> {
  data: (IncludeRelations extends true
    ? SubTopicDetailResponse<true>
    : SubTopicDetailResponse<false>)[]
  pagination: PaginationMeta
}

export interface NavigationSubTopicResponse<IncludeRelations extends boolean = false> {
  previous: (SubTopicDetailResponse<IncludeRelations> & { completed: boolean }) | null
  current: SubTopicDetailResponse<IncludeRelations> | null
  next: (SubTopicDetailResponse<IncludeRelations> & { unlocked: boolean }) | null
}
