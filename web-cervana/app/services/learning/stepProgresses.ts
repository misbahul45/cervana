import type { Query, Tokens } from "~/interfaces/api"
import type {
  StepProgress,
  StepProgressDetailResponse,
  StepProgressListResponse
} from "~/interfaces/learning/stepProgress"
import { request, toQueryString } from "~/lib/api"

export const stepProgressService = {
  async findAll<IncludeRelations extends boolean = false>(
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/learning/step-progresses?${queryString}`
      : "/learning/step-progresses"

    return request<StepProgressListResponse<IncludeRelations>>(
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
      ? `/learning/step-progresses/${id}?${queryString}`
      : `/learning/step-progresses/${id}`

    return request<StepProgressDetailResponse<IncludeRelations>>(
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
      stepId: string
    },
    tokens?: Tokens
  ) {
    return request<StepProgressDetailResponse>(
      `/learning/step-progresses`,
      "POST",
      data,
      { "Content-Type": "application/json" },
      true,
      tokens
    )
  },

  async update(
    id: string,
    data: Partial<StepProgress>,
    tokens?: Tokens
  ) {
    return request<StepProgressDetailResponse>(
      `/learning/step-progresses/${id}`,
      "PATCH",
      data,
      { "Content-Type": "application/json" },
      true,
      tokens
    )
  }
}
