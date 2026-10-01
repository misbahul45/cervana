import type { Query, Tokens } from "~/interfaces/api"
import type { LearningStyleProfileDetailResponse, LearningStyleProfileListResponse } from "~/interfaces/learning/LearningStyle"
import { request, toQueryString } from "~/lib/api"
import type { LearningStyleSchemaType } from "~/schemas/topic.schema"

export const learningStyleService = {
  async findAll<IncludeRelations extends boolean = false>(
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/learning/learning-styles?${queryString}`
      : "/learning/learning-styles"

    return request<LearningStyleProfileListResponse<IncludeRelations>>(
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
    const url = queryString
      ? `/learning/learning-styles/${id}?${queryString}`
      : `/learning/learning-styles/${id}`

    return request<LearningStyleProfileDetailResponse<IncludeRelations>>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },

  async create(body: LearningStyleSchemaType, tokens?: Tokens) {
    return request(
      "/learning/learning-styles",
      "POST",
      body,
      {},
      true,
      tokens
    )
  },

  async update(id: string, body: Partial<LearningStyleSchemaType>, tokens?: Tokens) {
    return request(
      `/learning/learning-styles/${id}`,
      "PATCH",
      body,
      {},
      true,
      tokens
    )
  }
}
