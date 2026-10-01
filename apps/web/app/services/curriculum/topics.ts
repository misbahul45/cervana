import type { Query } from "~/interfaces/api"
import type { TopicDetailResponse, TopicsListResponse } from "~/interfaces/curriculum/topics"
import { request, toQueryString } from "~/lib/api"


export const topicsService = {
  async findAll<IncludeRelations extends boolean = false>(
    q: Query = {},
  ) {
    const queryString = toQueryString(q)
    const url = queryString ? `/curriculum/topics?${queryString}` : "/curriculum/topics"
    return request<TopicsListResponse<IncludeRelations>>(url, "GET", undefined, {}, true)
  },

  async findOne<IncludeRelations extends boolean = false>(
    slug: string,
    q: Query = {},
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/curriculum/topics/${slug}?${queryString}`
      : `/curriculum/topics/${slug}`
    return request<TopicDetailResponse<IncludeRelations>>(url, "GET", undefined, {}, true)
  },  
}
