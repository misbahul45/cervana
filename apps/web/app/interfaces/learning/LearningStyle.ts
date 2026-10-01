import type { PaginationMeta } from "../api"
import type { UserTopic } from "./userTopic"

export interface LearningStyleProfile {
  id: string

  userTopicId: string

  visual: number | null
  auditory: number | null
  reading: number | null
  kinesthetic: number | null

  dominantStyle: string | null
  takenAt: string | Date | null

  userTopic?: UserTopic
}

export interface LearningStyleProfileDetailResponse<
  IncludeRelations extends boolean = false
> extends LearningStyleProfile {
  userTopic?: IncludeRelations extends true ? UserTopic : undefined;
}


export interface LearningStyleProfileListResponse<
  IncludeRelations extends boolean = false
> {
  data: (
    IncludeRelations extends true
      ? LearningStyleProfileDetailResponse<true>
      : LearningStyleProfile
  )[];
  pagination: PaginationMeta;
}

export interface CreateLearningStyleProfileDto {
  userTopicId: string
  visual: number
  auditory: number
  reading: number
  kinesthetic: number
  dominantStyle?: string
  takenAt?: Date
}
export interface UpdateLearningStyleProfileDto {
  visual?: number
  auditory?: number
  reading?: number
  kinesthetic?: number
  dominantStyle?: string
  takenAt?: Date
}


