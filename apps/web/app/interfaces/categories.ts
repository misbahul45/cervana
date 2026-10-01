import type { PaginationMeta } from "./api"
import type { BaseTopic } from "./curriculum/topics"

export interface BaseCategory {
  id: string
  name: string
  slug: string
  description?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}


export type CategoryDetailResponse<IncludeTopics extends boolean = false> = 
  BaseCategory & (IncludeTopics extends true 
    ? { topics: BaseTopic[] }
    : {})

export interface CategoriesListResponse<IncludeTopics extends boolean = false> {
  data: (IncludeTopics extends true 
    ? CategoryDetailResponse<true> 
    : BaseCategory)[]
  pagination:PaginationMeta
}
