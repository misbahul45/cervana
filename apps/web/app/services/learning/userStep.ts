import type { Query, Tokens } from "~/interfaces/api"
import type { UserStepDetailResponse, UserStepListResponse } from "~/interfaces/learning/userSteps"
import { request, toQueryString } from "~/lib/api"

export const userStepService = {
  async complete(id:string, token?:Tokens){
    const url=`/learning/user-steps/complete/${id}`
    return request<UserStepListResponse>(
      url,
      "POST",
      undefined,
      {},
      true,
      token
    )
  },
  async findAll<IncludeRelations extends boolean = false>(
    q: Query = {},
    tokens?: Tokens
  ) {
    const queryString = toQueryString(q)
    const url = queryString
      ? `/learning/user-steps?${queryString}`
      : "/learning/user-steps"

    return request<UserStepListResponse<IncludeRelations>>(
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
      ? `/learning/user-steps/${id}?${queryString}`
      : `/learning/user-steps/${id}`

    return request<UserStepDetailResponse<IncludeRelations>>(
      url,
      "GET",
      undefined,
      {},
      true,
      tokens
    )
  },
  listenUserStepsSse() {
    const config = useRuntimeConfig()
    const API_URL = config.public.API_URL
    return new EventSource(`${API_URL}/user-steps-sse`, {
      withCredentials: true
    })
  },
}
