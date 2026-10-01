import type { PaginationMeta } from "../api"
import type { User } from "../auth"
import type { BaseCategory } from "../categories"
import type { BaseSubTopic } from "./subTopics"

export interface BaseTopic {
  id: string
  title: string
  slug: string
  description?: string | null
  image?: Record<string, any> | null

  isVerified: boolean
  topicDuration: number
  price: number
  createdBy?: string | null
  createdAt: Date | string
  updatedAt: Date | string

  userTopicsCount: number
  ordersCount: number

  teacher?: Partial<User> | null
  categories?: BaseCategory[] | null
}


export interface TopicDetailResponse<
  IncludeRelations extends boolean = false
> extends BaseTopic {
  teacher?: IncludeRelations extends true ? Partial<User> : null
  categories?: IncludeRelations extends true ? BaseCategory[] : null
  subTopics?:IncludeRelations extends true ? BaseSubTopic[] : null
}

export interface TopicsListResponse<
  IncludeRelations extends boolean = false
> {
  data: (IncludeRelations extends true
    ? TopicDetailResponse<true>
    : BaseTopic)[]
  pagination: PaginationMeta           
}
