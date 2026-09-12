import type { Query } from "~/interfaces/api"
import type { StepDetailResponse, StepsListResponse } from "~/interfaces/curriculum/step"
import { request, toQueryString } from "~/lib/api"

export const stepsService = {
  async findAll<IncludeRelations extends boolean = false>(
    q: Query = {},
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/curriculum/steps?${queryString}`
      : `/curriculum/steps`

    return request<StepsListResponse<IncludeRelations>>(
      url,
      "GET",
      undefined,
      {},
      true,
    )
  },

  async findOne<IncludeRelations extends boolean = false>(
    id: string,
    q: Query = {},
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/curriculum/steps/${id}?${queryString}`
      : `/curriculum/steps/${id}`

    return request<StepDetailResponse<IncludeRelations>>(
      url,
      "GET",
      undefined,
      {},
      true,
    )
  },
}
