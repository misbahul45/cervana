import type { Query, Tokens } from "~/interfaces/api"
import type {
  LearningStatus,
  SubTopicProgressDetailResponse,
  SubTopicProgressListResponse
} from '~/interfaces/learning/subTopicProgress'
import { request, toQueryString } from "~/lib/api"

export const subTopicProgressService = {
  async findAll<IncludeRelations extends boolean = false>(
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/learning/subtopic-progresses?${queryString}`
      : "/learning/subtopic-progresses"

    return request<SubTopicProgressListResponse<IncludeRelations>>(
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
      ? `/learning/subtopic-progresses/${id}?${queryString}`
      : `/learning/subtopic-progresses/${id}`

    return request<SubTopicProgressDetailResponse<IncludeRelations>>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },

  async create(
    data: {
      userId: string
      subTopicId: string
      progress?: number
      completed?: boolean
      status?: LearningStatus
    },
    tokens?: Tokens
  ) {
    return request(
      "/learning/subtopic-progresses",
      "POST",
      data,
      {},
      true,
      tokens
    )
  },

  async update(
    id: string,
    data: Partial<{
      progress: number
      completed: boolean
      status: string
      startedAt: string
      completedAt: string | null
    }>,
    tokens?: Tokens
  ) {
    return request(
      `/learning/subtopic-progresses/${id}`,
      "PATCH",
      data,
      {},
      true,
      tokens
    )
  },

  async delete(id: string, tokens?: Tokens) {
    return request(
      `/learning/subtopic-progresses/${id}`,
      "DELETE",
      undefined,
      {},
      true,
      tokens
    )
  }
}
