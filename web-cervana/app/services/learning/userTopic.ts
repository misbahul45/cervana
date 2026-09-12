import type { Query, Tokens } from "~/interfaces/api"
import type {
  UserTopic,
  UserTopicDetailResponse,
  UserTopicListResponse 
}
from '~/interfaces/learning/userTopic' 
import { request, toQueryString } from "~/lib/api"

export const userTopicService = {
  async findAll<IncludeRelations extends boolean = false>(
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString ? `/learning/user-topics?${queryString}` : "/learning/user-topics"
    return request<UserTopicListResponse<IncludeRelations>>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },

  async findOne<IncludeRelations extends boolean = false>(
    id: string,
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString ? `/learning/user-topics/${id}?${queryString}` : `/learning/user-topics/${id}`
    return request<UserTopicDetailResponse<IncludeRelations>>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },

  async update(
    id: string,
    data: Partial<UserTopic>,
    tokens?: Tokens
  ) {
    return request<UserTopicDetailResponse>(
      `/learning/user-topics/${id}`,
      "PUT",
      data,
      { "Content-Type": "application/json" },
      true,
      tokens
    )
  }

}
