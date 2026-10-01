import type { Query, Tokens } from "~/interfaces/api"
import type { NavigationSubTopicResponse, SubTopicDetailResponse, SubTopicsListResponse } from "~/interfaces/curriculum/subTopics"
import { request, toQueryString } from "~/lib/api"

export const subTopicsService = {
  async findAll<IncludeRelations extends boolean = false>(q: Query = {}) {
    const queryString = toQueryString(q)
    const url = queryString ? `/curriculum/subtopics?${queryString}` : "/curriculum/subtopics"
    return request<SubTopicsListResponse<IncludeRelations>>(url, "GET", undefined, {}, true)
  },

  async findOne<IncludeRelations extends boolean = false>(
    id: string,
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/curriculum/subtopics/${id}?${queryString}`
      : `/curriculum/subtopics/${id}`
    return request<SubTopicDetailResponse<IncludeRelations>>(url, "GET", undefined, {}, true, tokens)
  },

  async findNavigation<IncludeRelations extends boolean = false>(
    id: string,
    tokens?: Tokens
  ) {
    const url = `/curriculum/subtopics/${id}/navigation`
    return request<NavigationSubTopicResponse<IncludeRelations>>(url, "GET", undefined, {}, true, tokens)
  },
}

